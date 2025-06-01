import sys
import os

# Add the project root to the Python path before other imports
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

import csv
import requests # For fetching images
from werkzeug.utils import secure_filename # For safe filenames
import uuid # For unique filenames
from flask import current_app # To access app.config
import xml.etree.ElementTree as ET # For XML parsing

from app import db
from app.models import Item, Category, Photo, Customer # Assuming Photo model exists and is similar to Item/Category
from app.services.image_service import ImageService # Import ImageService
from PIL import Image as PILImage # Ensure Pillow is imported for type hints if needed, though ImageService handles it

def get_or_create_category_path_id(category_path_str):
    if not category_path_str:
        print("Warning: Empty category path string received.")
        return None
    
    category_names = [name.strip() for name in category_path_str.split('>')]
    parent_id = None
    final_category_id = None

    for i, name in enumerate(category_names):
        if not name: # Handle cases like "Parent > > Child" or trailing ">
            print(f"Warning: Empty category name segment in path '{category_path_str}' at segment {i+1}. Skipping segment.")
            continue

        # Attempt to find the category with the current parent_id
        category = Category.query.filter_by(name=name, parent_id=parent_id).first()

        if not category:
            # Not found with specific parent, check if it exists globally (unique name constraint)
            globally_existing_category = Category.query.filter_by(name=name).first()
            if globally_existing_category:
                print(f"Warning: Category '{name}' in path '{category_path_str}' already exists globally with ID {globally_existing_category.id} (parent_id: {globally_existing_category.parent_id}). Desired parent was {parent_id}. Using existing global category.")
                category = globally_existing_category
            else:
                # Category does not exist at all, create it with the current parent_id
                print(f"Creating new category: '{name}' with parent_id: {parent_id} (from path: '{category_path_str}')")
                category = Category(name=name, parent_id=parent_id)
                db.session.add(category)
                try:
                    db.session.flush() # Flush to get ID and check for immediate errors
                except Exception as e:
                    db.session.rollback() # Rollback on flush error
                    print(f"ERROR: Could not create category '{name}' with parent_id {parent_id} due to: {e}. Path: '{category_path_str}'")
                    # Decide if we should return None or raise, or try to find an alternative
                    return None # Or re-raise e
        
        final_category_id = category.id
        parent_id = category.id # This becomes the parent for the next iteration
    
    try:
        db.session.commit() # Commit after the full hierarchy for this category_str is processed
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Could not commit session after processing category path '{category_path_str}' due to: {e}")
        return None # Or re-raise e
        
    return final_category_id

def process_attributes(item_name, item_description, row):
    """Processes attributes to modify item title and description."""
    new_title_parts = [item_name]
    new_description_lines = [item_description if item_description else ""]

    for i in range(1, 4): # Assuming up to 3 attributes as per header
        attr_name_col = f'Attribute {i} name'
        attr_value_col = f'Attribute {i} value(s)'

        attr_name = row.get(attr_name_col)
        attr_values = row.get(attr_value_col)

        if attr_name and attr_values: # Only process if both name and value(s) exist
            # Append attribute values to title parts
            new_title_parts.append(attr_values)
            
            # Append attribute name and value(s) to description lines
            new_description_lines.append(f"{attr_name}: {attr_values}")

    # Join title parts with space, filter out empty strings from concatenation if item_name was empty
    processed_title = ' '.join(filter(None, new_title_parts))
    # Join description lines with newline, filter out empty initial description
    processed_description = '\n'.join(filter(None,new_description_lines)).strip()

    return processed_title, processed_description

def download_and_store_images(images_csv_string, item_db_id):
    if not images_csv_string:
        return

    image_urls = [url.strip() for url in images_csv_string.split(',') if url.strip()]
    if not image_urls:
        return

    upload_folder = current_app.config.get('UPLOAD_FOLDER')
    if not upload_folder: # Should have been created by config.py or app init
        print("CRITICAL ERROR: UPLOAD_FOLDER is not configured or accessible.")
        return
    # os.makedirs(upload_folder, exist_ok=True) # Ensure it exists, handled by config or app init usually

    has_primary_image = Photo.query.filter_by(item_id=item_db_id, is_primary=True).first() is not None

    for i, image_url in enumerate(image_urls):
        temp_download_path = None # Path for initially downloaded file
        try:
            print(f"Attempting to download image: {image_url} for item_id: {item_db_id}")
            response = requests.get(image_url, stream=True, timeout=15)
            response.raise_for_status()

            original_filename_from_url = image_url.split('/')[-1].split('?')[0]
            # Use ImageService logic for base, large, small names from original filename characteristics
            # We need a "base" filename that ImageService would generate if it were an upload.
            # Let's adapt _generate_unique_filename slightly or use its pattern.
            # For the importer, the item_id and uuid make it unique enough for a base.
            ext = os.path.splitext(original_filename_from_url)[1].lower() or '.jpg' # Default ext
            if ext not in current_app.config['ALLOWED_EXTENSIONS'] and ext != '.jpeg': # fix for .jpeg vs .jpg in allowed
                 if ext == '.jpeg' and 'jpg' in current_app.config['ALLOWED_EXTENSIONS']:
                     pass # allow .jpeg if .jpg is allowed
                 else:
                    print(f"Skipping image {image_url}, extension {ext} not in ALLOWED_EXTENSIONS.")
                    continue
            
            # Generate a base filename for our records (this is what Photo.image_url will store)
            # This base name should NOT have _small or _large yet.
            base_db_filename = f"item_{item_db_id}_{uuid.uuid4().hex[:12]}{ext}"
            safe_base_db_filename = secure_filename(base_db_filename)

            # Define paths for large and small versions based on this base name
            name_part, ext_part = os.path.splitext(safe_base_db_filename)
            large_file_actual_name = f"{name_part}_large{ext_part}"
            small_file_actual_name = f"{name_part}_small{ext_part}"

            large_final_path = os.path.join(upload_folder, large_file_actual_name)
            small_final_path = os.path.join(upload_folder, small_file_actual_name)

            # Temporarily save the downloaded image
            temp_filename = f"temp_import_{safe_base_db_filename}"
            temp_download_path = os.path.join(upload_folder, temp_filename) 
            with open(temp_download_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Temporarily saved original to: {temp_download_path}")

            # Use ImageService._resize_image to create large and small versions
            success_large = ImageService._resize_image(
                temp_download_path, 
                large_final_path, 
                current_app.config['MAX_IMAGE_SIZE_LARGE'], 
                current_app.config['IMAGE_QUALITY']
            )
            success_small = ImageService._resize_image(
                temp_download_path, 
                small_final_path, 
                current_app.config['MAX_IMAGE_SIZE_SMALL'], 
                current_app.config['IMAGE_QUALITY']
            )

            if success_large and success_small:
                print(f"Successfully created large ({large_final_path}) and small ({small_final_path}) versions.")
                is_current_image_primary = False
                if not has_primary_image:
                    is_current_image_primary = True
                    has_primary_image = True
                
                photo_entry = Photo(item_id=item_db_id, image_url=safe_base_db_filename, is_primary=is_current_image_primary)
                db.session.add(photo_entry)
            else:
                print(f"ERROR: Failed to process one or both image sizes for {original_filename_from_url}. Large success: {success_large}, Small success: {success_small}")
                # Clean up if one part failed but other exists
                if os.path.exists(large_final_path): os.remove(large_final_path)
                if os.path.exists(small_final_path): os.remove(small_final_path)

        except requests.exceptions.RequestException as e:
            print(f"ERROR downloading {image_url}: {e}")
        except IOError as e:
            print(f"ERROR during file operation for {image_url}: {e}")
        except Exception as e:
            current_app.logger.error(f"An unexpected ERROR occurred while processing image {image_url} for item {item_db_id}: {e}", exc_info=True)
            print(f"An unexpected ERROR occurred while processing image {image_url}: {e}")
        finally:
            # Clean up temporary downloaded file
            if temp_download_path and os.path.exists(temp_download_path):
                try:
                    os.remove(temp_download_path)
                    print(f"Successfully deleted temporary file: {temp_download_path}")
                except OSError as e:
                    print(f"Error deleting temporary file {temp_download_path}: {e}")

def import_products_from_csv(csv_filepath):
    print(f"Starting product import from: {csv_filepath}")
    sku_to_id_map = {}
    variation_rows = []

    # Pass 1: Import simple and variable products, and collect variations
    print("--- Pass 1: Processing simple and variable products ---")
    with open(csv_filepath, mode='r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        for row_number, row in enumerate(reader, 1):
            print(f"DEBUG (Pass 1): Processing row {row_number}, SKU {row.get('SKU')}, Type {row.get('Type')}")
            
            sku = row.get('SKU')
            if not sku:
                print(f"Skipping row {row_number} due to missing SKU.")
                continue

            product_type = row.get('Type', 'simple').lower()

            if product_type == 'variation':
                variation_rows.append(row)
                print(f"Collected variation SKU {sku} for Pass 2.")
                continue # Skip processing variations in Pass 1

            # Process attributes for title and description selectively
            original_name = row.get('Name', sku) # Fallback to SKU if Name is empty
            original_description = row.get('Description', '')

            if product_type == 'simple':
                title, description = process_attributes(original_name, original_description, row)
                print(f"DEBUG (Pass 1, simple): Attributes processed for {sku}. New title: '{title}'")
            elif product_type == 'variable':
                title = original_name
                description = original_description
                print(f"DEBUG (Pass 1, variable): Using original name/desc for {sku}: '{title}'")
            else: # Should not happen given the previous logic, but as a fallback
                title = original_name
                description = original_description

            category_id = None
            categories_str = row.get('Categories')
            if categories_str:
                category_paths = [path.strip() for path in categories_str.split(',') if path.strip()]
                if category_paths:
                    first_category_path_str = category_paths[0]
                    category_id = get_or_create_category_path_id(first_category_path_str)

            stock_quantity_str = row.get('Stock', '0')
            stock_quantity = int(stock_quantity_str) if stock_quantity_str else 0
            price_str = row.get('Regular price', '0.0')
            price = float(price_str) if price_str else 0.0

            parent_id_val = -1 # Default for simple products
            if product_type == 'variable':
                parent_id_val = -2

            existing_item = Item.query.filter_by(sku=sku).first()
            if existing_item:
                print(f"Updating existing item (Type: {product_type}): {title} (SKU: {sku})")
                existing_item.title = title
                existing_item.description = description
                existing_item.stock_quantity = stock_quantity
                existing_item.price = price
                existing_item.category_id = category_id
                existing_item.parent_id = parent_id_val 
                # Update other fields if necessary, ensure is_current_version etc. are correct for variable parents
                item_id = existing_item.id
            else:
                print(f"Creating new item (Type: {product_type}): {title} (SKU: {sku})")
                item = Item(
                    sku=sku,
                    title=title,
                    description=description,
                    stock_quantity=stock_quantity,
                    price=price,
                    category_id=category_id,
                    parent_id=parent_id_val,
                    is_current_version=True, 
                    is_stock_tracked=bool(stock_quantity_str), # Track stock if stock is specified
                    is_active=True
                )
                db.session.add(item)
                db.session.flush() # Flush to get the item ID for the map
                item_id = item.id
            
            sku_to_id_map[sku] = item_id
            
            # Download and store images for the item
            images_csv = row.get('Images')
            if images_csv and item_id: # item_id is from existing_item.id or item.id after flush
                download_and_store_images(images_csv, item_id)

        print("Committing Pass 1 changes (including photos)...")
        db.session.commit()

    # Pass 2: Import variation products
    print(f"--- Pass 2: Processing {len(variation_rows)} collected variations ---")
    for row_number, row in enumerate(variation_rows, 1):
        sku = row.get('SKU')
        parent_sku = row.get('Parent')
        print(f"DEBUG (Pass 2): Processing variation row {row_number}, SKU {sku}, Parent SKU {parent_sku}")

        if not sku or not parent_sku:
            print(f"Skipping variation SKU {sku} due to missing SKU or Parent SKU.")
            continue

        parent_db_id = sku_to_id_map.get(parent_sku)
        if not parent_db_id:
            print(f"ERROR: Parent item with SKU '{parent_sku}' not found in sku_to_id_map for variation SKU '{sku}'. Skipping variation.")
            continue

        # Process attributes for title and description
        original_name = row.get('Name', sku) # Fallback to SKU if Name is empty
        original_description = row.get('Description', '')
        title, description = process_attributes(original_name, original_description, row)

        category_id = None # Variations usually inherit category from parent, but can have their own in some WC setups
        # For now, let's assume variations don't get their own category from the CSV column directly unless specified
        # We could also try to fetch parent's category_id: parent_item = Item.query.get(parent_db_id); category_id = parent_item.category_id
        # Or, if the CSV can specify categories for variations, uncomment and adapt:
        # categories_str = row.get('Categories') 
        # if categories_str:
        #     category_paths = [path.strip() for path in categories_str.split(',') if path.strip()]
        #     if category_paths:
        #         first_category_path_str = category_paths[0]
        #         category_id = get_or_create_category_path_id(first_category_path_str)

        stock_quantity_str = row.get('Stock', '0')
        stock_quantity = int(stock_quantity_str) if stock_quantity_str else 0
        price_str = row.get('Regular price', '0.0')
        price = float(price_str) if price_str else 0.0

        existing_item = Item.query.filter_by(sku=sku).first()
        if existing_item:
            print(f"Updating existing variation: {title} (SKU: {sku})")
            existing_item.title = title
            existing_item.description = description
            existing_item.stock_quantity = stock_quantity
            existing_item.price = price
            existing_item.parent_id = parent_db_id
            existing_item.category_id = category_id # Set if variations can have own categories
            # Update other fields if necessary
        else:
            print(f"Creating new variation: {title} (SKU: {sku}) for parent ID {parent_db_id}")
            item = Item(
                sku=sku,
                title=title,
                description=description,
                stock_quantity=stock_quantity,
                price=price,
                parent_id=parent_db_id,
                category_id=category_id, # Set if variations can have own categories
                is_current_version=True, 
                is_stock_tracked=bool(stock_quantity_str),
                is_active=True
            )
            db.session.add(item)

        # Download and store images for the variation item
        images_csv_variation = row.get('Images')
        # Get the actual item_id for the variation, whether it was updated or newly created
        # If it was updated, existing_item.id is the one. If created, we need to flush and get item.id.
        # For simplicity, let's assume we always re-query or ensure item_id_for_photo is set.
        
        # Re-fetch or ensure current item_id for photos if item was just added
        current_item_for_photo = Item.query.filter_by(sku=sku).first() 
        if current_item_for_photo and images_csv_variation:
             download_and_store_images(images_csv_variation, current_item_for_photo.id)
        elif not current_item_for_photo:
            print(f"ERROR (Pass 2 Photos): Could not find item with SKU {sku} to associate images.")

    print("Committing Pass 2 changes (including photos)...")
    db.session.commit()
    print("Product import finished.")

# --- XML Import Functions ---

NAMESPACES = {
    'wp': 'http://wordpress.org/export/1.2/',
    'content': 'http://purl.org/rss/1.0/modules/content/',
    'excerpt': 'http://wordpress.org/export/1.2/excerpt/',
    'dc': 'http://purl.org/dc/elements/1.1/',
    # Add other namespaces if they appear in the XML header
}

def get_element_text(element, tag_name, namespace='wp'):
    """Helper to get text from an XML element, handling namespaces."""
    if element is None:
        return None
    ns_tag = f'{{{NAMESPACES[namespace]}}}{tag_name}'
    found_element = element.find(ns_tag)
    return found_element.text if found_element is not None and found_element.text else None

def import_customers_from_wxr(xml_filepath):
    print(f"Starting customer import from WXR file: {xml_filepath}")
    customers_created = 0
    customers_updated = 0
    elements_processed_count = 0

    try:
        # iterparse returns an iterator yielding (event, elem) pairs
        for event, elem in ET.iterparse(xml_filepath, events=('end',)):
            elements_processed_count += 1
            current_tag = elem.tag
            # print(f"DEBUG: Event: {event}, Element ended: {current_tag}, Processed count: {elements_processed_count}") # Very verbose

            if current_tag == f'{{{NAMESPACES["wp"]}}}author':
                print(f"Processing <wp:author> element. Total elements scanned: {elements_processed_count}")
                login = get_element_text(elem, 'author_login')
                email = get_element_text(elem, 'author_email')
                display_name = get_element_text(elem, 'author_display_name')
                first_name = get_element_text(elem, 'author_first_name')
                last_name = get_element_text(elem, 'author_last_name')

                if not email and not login:
                    print(f"Skipping author record due to missing email and login. DisplayName: {display_name}")
                    elem.clear()
                    # If the root of the item we're interested in is elem, 
                    # and we've processed it or decided to skip it, we should also ensure its parent drops it.
                    # This is complex with iterparse alone. Root.remove(elem) is for when you have the parent.
                    # For iterparse, clearing the element itself after processing is key.
                    # And ensuring the main loop continues processing other elements.
                    continue

                customer_name = display_name
                if first_name and last_name and (first_name.strip() or last_name.strip()):
                    customer_name = f"{first_name.strip()} {last_name.strip()}".strip()
                elif not customer_name and login:
                    customer_name = login
                
                if not customer_name:
                     print(f"Skipping author {email or login} due to missing name fields after fallbacks.")
                     elem.clear()
                     continue
                
                customer = None
                try:
                    if email:
                        customer = Customer.query.filter_by(email=email).first()
                    
                    if customer:
                        # print(f"Customer with email '{email}' already exists (ID: {customer.id}). Skipping update for now.")
                        # Add update logic here if needed for existing customers
                        # e.g., if not customer.name and customer_name: customer.name = customer_name; db.session.add(customer)
                        customers_updated += 1
                    else:
                        print(f"Attempting to create new customer: {customer_name} (Email: {email}, Login: {login})")
                        new_customer_data = {
                            'name': customer_name,
                            'email': email,
                        }
                        if new_customer_data['email'] is None:
                            del new_customer_data['email'] # Should not happen if email is mandatory
                        
                        # Ensure email is present for new customer as it's a primary identifier here
                        if not new_customer_data.get('email'):
                             print(f"Cannot create customer {customer_name} (Login: {login}) without an email address.")
                             elem.clear()
                             continue

                        new_customer = Customer(**new_customer_data)
                        db.session.add(new_customer)
                        db.session.flush() # Use flush to catch immediate errors like duplicate email
                        customers_created += 1
                        print(f"Successfully flushed new customer: {customer_name} (ID: {new_customer.id if new_customer else 'Error'})")
                
                except Exception as db_error:
                    db.session.rollback()
                    print(f"DB ERROR for customer (Login: {login}, Email: {email}): {db_error}")
                finally:
                    elem.clear() # Ensure element is cleared in all cases after processing its data
            
            # The problematic elif block using elem.getparent() is now removed.
            # We are now only explicitly clearing wp:author elements handled above.
            # If other sibling elements (like <item>) are very large and numerous,
            # they might still cause memory issues if not cleared.
            # However, iterparse should discard elements once they (and their children) 
            # have been fully parsed and their 'end' event has passed, 
            # unless we hold references to them.
            
            # To be absolutely sure other potentially large sibling elements are cleared 
            # after their 'end' event if they are not our target 'wp:author' tag:
            # (This is a general clear for any element not specifically handled)
            else:
                if elem.tag not in [f'{{{NAMESPACES["wp"]}}}author', f'{{{NAMESPACES["wp"]}}}wxr_version', 'channel', 'rss']: # Avoid clearing structural tags too early
                    # print(f"DEBUG: Clearing generic element: {elem.tag}")
                    elem.clear()

        # Final commit after the loop
        print("Committing final batch of customers to database...")
        db.session.commit()
        print(f"Customer import loop finished. Total elements scanned: {elements_processed_count}. Created: {customers_created}, Updated/Checked: {customers_updated}")

    except ET.ParseError as e:
        print(f"XML Parse Error during customer import: {e}")
        db.session.rollback()
    except FileNotFoundError:
        print(f"Error: WXR file not found at {xml_filepath}")
    except Exception as e:
        print(f"An unexpected error occurred during customer import: {e}")
        current_app.logger.error(f"WXR Customer Import Error: {e}", exc_info=True)
        db.session.rollback()

def import_sales_from_wxr(xml_filepath):
    print(f"Starting sales import from WXR file: {xml_filepath} - (Placeholder - Not Implemented Yet)")
    # TODO: Implement sales import logic
    # This will involve parsing <item> tags, checking <wp:post_type> for orders,
    # then extracting order details and line items from <wp:postmeta> and other tags.
    pass

if __name__ == '__main__':
    # ... (sys.path setup) ...
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    sys.path.insert(0, project_root)

    from app import create_app
    
    # Choose which importer to run
    # IMPORT_TARGET = 'products'
    IMPORT_TARGET = 'customers' # Or 'sales' or 'all'

    # XML file path for customers/sales
    wxr_xml_file = os.path.join(project_root, 'app', 'importers', 'truebluedealers.WordPress.complete.xml')
    # CSV file path for products
    csv_file_name = 'wc-product-export-1-6-2025-1748747602744.csv'
    csv_file_path = os.path.join(project_root, 'app', 'importers', csv_file_name)

    app = create_app()
    with app.app_context():
        if IMPORT_TARGET == 'products':
            print(f"Importing PRODUCTS from: {csv_file_path}")
            import_products_from_csv(csv_file_path)
            print("Product import finished.")
        elif IMPORT_TARGET == 'customers':
            print(f"Importing CUSTOMERS from: {wxr_xml_file}")
            import_customers_from_wxr(wxr_xml_file)
            print("Customer import process finished.")
        elif IMPORT_TARGET == 'sales':
            print(f"Importing SALES from: {wxr_xml_file}")
            import_sales_from_wxr(wxr_xml_file)
            print("Sales import process finished.")
        elif IMPORT_TARGET == 'all': # Example for running multiple imports
            print(f"Importing PRODUCTS from: {csv_file_path}")
            import_products_from_csv(csv_file_path)
            print("Product import finished.")
            print(f"Importing CUSTOMERS from: {wxr_xml_file}")
            import_customers_from_wxr(wxr_xml_file)
            print("Customer import process finished.")
            # print(f"Importing SALES from: {wxr_xml_file}")
            # import_sales_from_wxr(wxr_xml_file)
            # print("Sales import process finished.")
        else:
            print(f"Unknown IMPORT_TARGET: {IMPORT_TARGET}")