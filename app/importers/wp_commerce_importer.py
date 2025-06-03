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
from datetime import datetime # For parsing date strings

from app import db
from app.models import Item, Category, Photo, Customer, Sale, SaleItem # Customer model will be used if CSV for customers is provided
from app.services.image_service import ImageService 
from PIL import Image as PILImage 

def get_or_create_category_path_id(category_path_str):
    if not category_path_str:
        print("Warning: Empty category path string received.")
        return None
    
    category_names = [name.strip() for name in category_path_str.split('>')]
    parent_id = None
    final_category_id = None

    for i, name in enumerate(category_names):
        if not name: 
            print(f"Warning: Empty category name segment in path '{category_path_str}' at segment {i+1}. Skipping segment.")
            continue

        category = Category.query.filter_by(name=name, parent_id=parent_id).first()

        if not category:
            globally_existing_category = Category.query.filter_by(name=name).first()
            if globally_existing_category:
                print(f"Warning: Category '{name}' in path '{category_path_str}' already exists globally with ID {globally_existing_category.id} (parent_id: {globally_existing_category.parent_id}). Desired parent was {parent_id}. Using existing global category.")
                category = globally_existing_category
            else:
                print(f"Creating new category: '{name}' with parent_id: {parent_id} (from path: '{category_path_str}')")
                category = Category(name=name, parent_id=parent_id)
                db.session.add(category)
                try:
                    db.session.flush() 
                except Exception as e:
                    db.session.rollback() 
                    print(f"ERROR: Could not create category '{name}' with parent_id {parent_id} due to: {e}. Path: '{category_path_str}'")
                    return None 
        
        final_category_id = category.id
        parent_id = category.id 
    
    try:
        db.session.commit() 
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Could not commit session after processing category path '{category_path_str}' due to: {e}")
        return None 
        
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
    if not upload_folder: 
        print("CRITICAL ERROR: UPLOAD_FOLDER is not configured or accessible.")
        return

    has_primary_image = Photo.query.filter_by(item_id=item_db_id, is_primary=True).first() is not None

    for i, image_url in enumerate(image_urls):
        temp_download_path = None 
        try:
            print(f"Attempting to download image: {image_url} for item_id: {item_db_id}")
            response = requests.get(image_url, stream=True, timeout=15)
            response.raise_for_status()

            original_filename_from_url = image_url.split('/')[-1].split('?')[0]
            ext = os.path.splitext(original_filename_from_url)[1].lower() or '.jpg' 
            if ext not in current_app.config['ALLOWED_EXTENSIONS'] and ext != '.jpeg': 
                 if ext == '.jpeg' and 'jpg' in current_app.config['ALLOWED_EXTENSIONS']:
                     pass 
                 else:
                    print(f"Skipping image {image_url}, extension {ext} not in ALLOWED_EXTENSIONS.")
                    continue
            
            base_db_filename = f"item_{item_db_id}_{uuid.uuid4().hex[:12]}{ext}"
            safe_base_db_filename = secure_filename(base_db_filename)

            name_part, ext_part = os.path.splitext(safe_base_db_filename)
            large_file_actual_name = f"{name_part}_large{ext_part}"
            small_file_actual_name = f"{name_part}_small{ext_part}"

            large_final_path = os.path.join(upload_folder, large_file_actual_name)
            small_final_path = os.path.join(upload_folder, small_file_actual_name)

            temp_filename = f"temp_import_{safe_base_db_filename}"
            temp_download_path = os.path.join(upload_folder, temp_filename) 
            with open(temp_download_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Temporarily saved original to: {temp_download_path}")

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
                continue 

            original_name = row.get('Name', sku) 
            original_description = row.get('Description', '')

            if product_type == 'simple':
                title, description = process_attributes(original_name, original_description, row)
                print(f"DEBUG (Pass 1, simple): Attributes processed for {sku}. New title: '{title}'")
            elif product_type == 'variable':
                title = original_name
                description = original_description
                print(f"DEBUG (Pass 1, variable): Using original name/desc for {sku}: '{title}'")
            else: 
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

            parent_id_val = -1 
            if product_type == 'variable':
                parent_id_val = -2

            existing_item = Item.query.filter_by(sku=sku).first()
            item_id = None # Initialize item_id
            if existing_item:
                print(f"Updating existing item (Type: {product_type}): {title} (SKU: {sku})")
                existing_item.title = title
                existing_item.description = description
                existing_item.stock_quantity = stock_quantity
                existing_item.price = price
                existing_item.category_id = category_id
                existing_item.parent_id = parent_id_val 
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
                    is_stock_tracked=bool(stock_quantity_str), 
                    is_active=True
                )
                db.session.add(item)
                db.session.flush() 
                item_id = item.id
            
            if sku and item_id: # Ensure SKU and item_id are valid before adding to map
                 sku_to_id_map[sku] = item_id
            
            images_csv = row.get('Images')
            if images_csv and item_id: 
                download_and_store_images(images_csv, item_id)

        print("Committing Pass 1 changes (including photos)...")
        db.session.commit()

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

        original_name = row.get('Name', sku) 
        original_description = row.get('Description', '')
        title, description = process_attributes(original_name, original_description, row)

        category_id = None 

        stock_quantity_str = row.get('Stock', '0')
        stock_quantity = int(stock_quantity_str) if stock_quantity_str else 0
        price_str = row.get('Regular price', '0.0')
        price = float(price_str) if price_str else 0.0

        existing_item = Item.query.filter_by(sku=sku).first()
        item_id_for_photo = None # Initialize
        if existing_item:
            print(f"Updating existing variation: {title} (SKU: {sku})")
            existing_item.title = title
            existing_item.description = description
            existing_item.stock_quantity = stock_quantity
            existing_item.price = price
            existing_item.parent_id = parent_db_id
            existing_item.category_id = category_id 
            item_id_for_photo = existing_item.id
        else:
            print(f"Creating new variation: {title} (SKU: {sku}) for parent ID {parent_db_id}")
            item = Item(
                sku=sku,
                title=title,
                description=description,
                stock_quantity=stock_quantity,
                price=price,
                parent_id=parent_db_id,
                category_id=category_id, 
                is_current_version=True, 
                is_stock_tracked=bool(stock_quantity_str),
                is_active=True
            )
            db.session.add(item)
            db.session.flush() # Flush to get ID for photo association
            item_id_for_photo = item.id
        
        images_csv_variation = row.get('Images')
        if images_csv_variation and item_id_for_photo:
             download_and_store_images(images_csv_variation, item_id_for_photo)
        elif images_csv_variation and not item_id_for_photo:
            print(f"ERROR (Pass 2 Photos): Could not determine item ID for SKU {sku} to associate images.")

    print("Committing Pass 2 changes (including photos)...")
    db.session.commit()
    print("Product import finished.")

def import_customers_from_csv(csv_filepath):
    print(f"Starting customer import from CSV file: {csv_filepath}")
    customers_created = 0
    customers_updated = 0
    rows_processed = 0

    with open(csv_filepath, mode='r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        for row_number, row in enumerate(reader, 1):
            rows_processed += 1
            email = row.get('user_email', '').strip()
            if not email:
                print(f"Skipping row {row_number} due to missing user_email.")
                continue

            # Determine Name
            first_name = row.get('first_name', '').strip()
            last_name = row.get('last_name', '').strip()
            display_name = row.get('display_name', '').strip()
            user_nicename = row.get('user_nicename', '').strip()
            user_login = row.get('user_login', '').strip()

            name = ""
            if first_name or last_name:
                name = f"{first_name} {last_name}".strip()
            elif display_name:
                name = display_name
            elif user_nicename:
                name = user_nicename
            elif user_login:
                name = user_login
            else:
                print(f"Skipping row {row_number} (Email: {email}) due to no usable name fields.")
                continue
            
            # Determine Phone - Assuming 'meta:billing_phone' if 'billing_phone' is missing
            phone = row.get('billing_phone', '').strip()
            if not phone:
                phone = row.get('meta:billing_phone', '').strip() # Corrected from illing_phone
                if not phone: # Check the literal illing_phone just in case
                    phone = row.get('meta:illing_phone', '').strip()

            # Determine Address - Assuming 'meta:billing_... ' if direct ones are missing
            addr_fields = [
                row.get('billing_address_1', '').strip(),
                row.get('billing_address_2', '').strip(),
                row.get('billing_city', '').strip(),
                row.get('billing_state', '').strip(),
                row.get('billing_postcode', '').strip(),
                row.get('billing_country', '').strip()
            ]
            address = ', '.join(filter(None, addr_fields)) # Join non-empty parts
            
            if not address.strip(): # Check meta fields if primary address is empty
                meta_addr_fields = [
                    row.get('meta:billing_address_1', '').strip(),
                    row.get('meta:billing_address_2', '').strip(),
                    row.get('meta:billing_city', '').strip(),
                    row.get('meta:billing_state', '').strip(),
                    row.get('meta:billing_postcode', '').strip(),
                    row.get('meta:billing_country', '').strip()
                ]
                # And check the literal illing just in case
                if not any(meta_addr_fields):
                    meta_addr_fields = [
                        row.get('meta:illing_address_1', '').strip(),
                        row.get('meta:illing_address_2', '').strip(),
                        row.get('meta:illing_city', '').strip(),
                        row.get('meta:illing_state', '').strip(),
                        row.get('meta:illing_postcode', '').strip(),
                        row.get('meta:illing_country', '').strip()
                    ]
                address = ', '.join(filter(None, meta_addr_fields))

            # Determine Company Name - Assuming 'meta:billing_company' if direct one is missing
            company_name = row.get('billing_company', '').strip()
            if not company_name:
                company_name = row.get('meta:billing_company', '').strip()
                if not company_name:
                     company_name = row.get('meta:illing_company', '').strip()

            # Upsert logic
            customer = Customer.query.filter_by(email=email).first()
            if customer:
                print(f"Updating customer ID {customer.id} (Email: {email})")
                customer.name = name if name else customer.name # Only update if new data is not empty
                customer.phone = phone if phone else customer.phone
                customer.address = address if address.strip() else customer.address
                customer.company_name = company_name if company_name else customer.company_name
                customers_updated += 1
            else:
                print(f"Creating new customer: {name} (Email: {email})")
                customer = Customer(
                    name=name,
                    email=email,
                    phone=phone if phone else None, # Store None if empty
                    address=address if address.strip() else None,
                    company_name=company_name if company_name else None
                )
                db.session.add(customer)
                customers_created += 1
            
            if rows_processed % 100 == 0:
                print(f"Processed {rows_processed} customer rows. Committing batch...")
                try:
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    print(f"Error committing batch at row {rows_processed}: {e}")
    
    try:
        db.session.commit() # Final commit
    except Exception as e:
        db.session.rollback()
        print(f"Error on final commit of customers: {e}")

    print(f"Customer import from CSV finished. Processed: {rows_processed}, Created: {customers_created}, Updated: {customers_updated}")

def parse_line_item_string(line_item_str):
    """Parses a pipe-separated key:value string into a dictionary."""
    data = {}
    if not line_item_str or not isinstance(line_item_str, str):
        return data
    parts = line_item_str.split('|')
    for part in parts:
        if ':' in part:
            key, value = part.split(':', 1)
            data[key.strip()] = value.strip()
    return data

def import_sales_from_csv(csv_filepath):
    print(f"Starting sales import from CSV file: {csv_filepath}")
    sales_created_count = 0
    sale_items_created_count = 0
    customers_created_from_orders_count = 0
    customers_updated_from_orders_count = 0
    rows_processed = 0

    # Status mapping from CSV to BasicPOS Sale.status enum
    status_mapping = {
        'completed': 'Paid',
        'processing': 'Open', # Or 'Invoice' depending on workflow
        'pending': 'Open',
        'on-hold': 'Open',
        'cancelled': 'Void',
        'refunded': 'Void', # Or a specific 'Refunded' status if your enum supports it
        'failed': 'Void'
    }

    with open(csv_filepath, mode='r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        for row_number, row in enumerate(reader, 1):
            rows_processed += 1
            print(f"Processing Order Row {row_number}: Order ID {row.get('order_id')}")

            # --- 1. Get/Create Customer --- 
            customer_email = row.get('customer_email', '').strip()
            if not customer_email:
                customer_email = row.get('billing_email', '').strip() # Fallback to billing_email

            db_customer = None
            if customer_email:
                db_customer = Customer.query.filter_by(email=customer_email).first()
                if db_customer:
                    # Optionally update customer details from order if more complete
                    # For now, just note that customer was found/updated count
                    customers_updated_from_orders_count +=1
                else:
                    # Create new customer from order details
                    cust_first_name = row.get('billing_first_name', '').strip()
                    cust_last_name = row.get('billing_last_name', '').strip()
                    cust_name = f"{cust_first_name} {cust_last_name}".strip() or customer_email # Fallback to email if name is empty
                    
                    cust_phone = row.get('billing_phone', '').strip()
                    addr_fields = [
                        row.get('billing_address_1', '').strip(), row.get('billing_address_2', '').strip(),
                        row.get('billing_city', '').strip(), row.get('billing_state', '').strip(),
                        row.get('billing_postcode', '').strip(), row.get('billing_country', '').strip()
                    ]
                    cust_address = ', '.join(filter(None, addr_fields))
                    cust_company = row.get('billing_company', '').strip()

                    print(f"  Creating new customer from order: {cust_name} (Email: {customer_email})")
                    db_customer = Customer(
                        name=cust_name,
                        email=customer_email,
                        phone=cust_phone if cust_phone else None,
                        address=cust_address if cust_address.strip() else None,
                        company_name=cust_company if cust_company else None
                    )
                    db.session.add(db_customer)
                    try:
                        db.session.flush() # Get ID for the sale record
                        customers_created_from_orders_count += 1
                    except Exception as e_cust_flush:
                        db.session.rollback()
                        print(f"  ERROR flushing new customer {cust_name} from order {row.get('order_id')}: {e_cust_flush}")
                        db_customer = None # Ensure db_customer is None if creation failed
            
            if not db_customer and not row.get('customer_id'): # If no email and no WP customer_id, cannot link reliably
                print(f"  Skipping Order ID {row.get('order_id')} as customer could not be identified or created.")
                continue

            # --- 2. Create Sale Record ---
            sale_status_csv = row.get('status', '').lower()
            sale_status_basicpos = status_mapping.get(sale_status_csv, 'Open') # Default to 'Open' if unmapped

            order_date_str = row.get('order_date')
            sale_created_at = None
            if order_date_str:
                try:
                    sale_created_at = datetime.strptime(order_date_str, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    print(f"  Warning: Could not parse order_date '{order_date_str}' for order {row.get('order_id')}. Setting created_at to None.")
            
            new_sale = Sale(
                customer_id=db_customer.id if db_customer else None,
                status=sale_status_basicpos,
                created_at=sale_created_at,
                updated_at=sale_created_at, # Can be same as created for import
                customer_notes=row.get('customer_note')
                # purchase_order_number - check if available in CSV, e.g. row.get('po_number')
            )
            db.session.add(new_sale)
            try:
                db.session.flush() # To get the sale_id for sale_items
                sales_created_count += 1
                current_sale_id = new_sale.id
                print(f"  Successfully created Sale record ID {current_sale_id} for Order ID {row.get('order_id')}")
            except Exception as e_sale_flush:
                db.session.rollback()
                print(f"  ERROR flushing new Sale for Order ID {row.get('order_id')}: {e_sale_flush}")
                continue # Skip to next order if sale creation fails

            # --- 3. Parse and Create SaleItem Records ---
            for i in range(1, 14): # Assuming max line_item_13 from header sample
                line_item_col = f'line_item_{i}'
                line_item_str = row.get(line_item_col)
                if line_item_str:
                    print(f"    Processing {line_item_col}: {line_item_str[:100]}...") # Print start of string
                    line_data = parse_line_item_string(line_item_str)
                    
                    db_item = None # Initialize db_item for each line_item
                    item_name_from_line = line_data.get('name', 'Unknown Imported Item').strip()
                    item_sku_from_line = line_data.get('sku', '').strip()

                    if item_sku_from_line:
                        db_item = Item.query.filter_by(sku=item_sku_from_line).first()
                    
                    if not db_item and item_name_from_line: 
                        # print(f"      SKU '{item_sku_from_line}' not found or empty. Trying to match by name: '{item_name_from_line}'")
                        db_item = Item.query.filter_by(title=item_name_from_line).first()
                        if db_item:
                            print(f"      Found item by name: {item_name_from_line} (ID: {db_item.id})")
                                         
                    if not db_item:
                        print(f"      Product SKU '{item_sku_from_line}' or Name '{item_name_from_line}' not found. Creating placeholder item.")
                        placeholder_sku = item_sku_from_line
                        if not placeholder_sku: 
                            placeholder_sku = f"IMPORTED_PLACEHOLDER_{uuid.uuid4().hex[:8]}"
                            print(f"        Original SKU empty, generated placeholder SKU: {placeholder_sku}")
                        
                        existing_placeholder_check = Item.query.filter_by(sku=placeholder_sku).first()
                        if existing_placeholder_check:
                            print(f"        Placeholder SKU '{placeholder_sku}' collision. Using existing item ID: {existing_placeholder_check.id}")
                            db_item = existing_placeholder_check
                        else:
                            new_placeholder_item = Item(
                                sku=placeholder_sku,
                                title=item_name_from_line[:255], 
                                description="Placeholder item imported from past sale.",
                                stock_quantity=0,
                                is_stock_tracked=False,
                                price=0.00, 
                                show_on_website=False,
                                is_active=False,
                                parent_id=-1, 
                                category_id=None 
                            )
                            db.session.add(new_placeholder_item)
                            try:
                                db.session.flush() 
                                db_item = new_placeholder_item # Assign the newly created item to db_item
                                print(f"        Created placeholder Item ID: {db_item.id}, SKU: {db_item.sku}, Title: {db_item.title}")
                            except Exception as e_placeholder_flush:
                                db.session.rollback()
                                print(f"        ERROR flushing placeholder item SKU '{placeholder_sku}': {e_placeholder_flush}. Skipping line item.")
                                continue 
                    
                    if not db_item: 
                        print(f"      CRITICAL ERROR: Could not find or create item for SKU '{item_sku_from_line}' / Name '{item_name_from_line}'. Skipping line item.")
                        continue

                    try:
                        quantity = int(line_data.get('quantity', 1))
                        line_sub_total_str = line_data.get('sub_total')
                        line_total_str = line_data.get('total')
                        price_str_to_use = line_sub_total_str if line_sub_total_str else line_total_str
                        if not price_str_to_use:
                             print(f"      ERROR: Missing total/sub_total for line item {item_name_from_line}. Skipping.")
                             continue
                        line_price_for_qty = float(price_str_to_use)
                        sale_price_per_item = line_price_for_qty / quantity if quantity != 0 else 0

                        sale_item_entry = SaleItem(
                            sale_id=current_sale_id,
                            item_id=db_item.id,
                            quantity=quantity,
                            sale_price=sale_price_per_item,
                            price_at_sale=sale_price_per_item 
                        )
                        db.session.add(sale_item_entry)
                        sale_items_created_count += 1
                    except ValueError as ve:
                        print(f"      ERROR parsing quantity/price for line '{item_name_from_line}': {ve}. Data: quantity='{line_data.get('quantity')}', total='{line_total_str}'")
                    except Exception as e_li:
                        print(f"      UNEXPECTED ERROR creating SaleItem for '{item_name_from_line}': {e_li}")

            if rows_processed % 20 == 0: # Commit more frequently for sales due to multiple objects
                print(f"Processed {rows_processed} order rows. Committing batch...")
                try:
                    db.session.commit()
                except Exception as e_batch_commit:
                    db.session.rollback()
                    print(f"Error committing sales batch at order row {rows_processed}: {e_batch_commit}")

    try:
        db.session.commit() # Final commit
    except Exception as e_final_commit:
        db.session.rollback()
        print(f"Error on final commit of sales: {e_final_commit}")

    print(f"Sales import from CSV finished. Orders Processed: {rows_processed}, Sales Created: {sales_created_count}, SaleItems Created: {sale_items_created_count}, Customers Created via Order: {customers_created_from_orders_count}, Customers Updated via Order (checked): {customers_updated_from_orders_count}")

if __name__ == '__main__':
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    sys.path.insert(0, project_root)

    from app import create_app
    
    # CHOOSE YOUR IMPORT TARGET HERE:
    # IMPORT_TARGET = 'products'
    # IMPORT_TARGET = 'customers'
    IMPORT_TARGET = 'sales'
    # IMPORT_TARGET = 'all'

    # --- Define CSV file paths ---
    product_csv_filename = 'wc-product-export-1-6-2025-1748747602744.csv'
    product_csv_path = os.path.join(project_root, 'app', 'importers', product_csv_filename)

    customer_csv_filename = 'customers.csv'
    customer_csv_path = os.path.join(project_root, 'app', 'importers', customer_csv_filename)
    
    sales_csv_filename = 'order_export_2025-06-01-05-37-23.csv' # UPDATE THIS FILENAME IF YOURS IS DIFFERENT
    sales_csv_path = os.path.join(project_root, 'app', 'importers', sales_csv_filename)

    app = create_app()
    with app.app_context():
        if IMPORT_TARGET == 'products':
            print(f"Importing PRODUCTS from: {product_csv_path}")
            import_products_from_csv(product_csv_path)
            print(f"Product import process finished.")

        elif IMPORT_TARGET == 'customers':
            print(f"Importing CUSTOMERS from: {customer_csv_path}")
            if os.path.exists(customer_csv_path):
                import_customers_from_csv(customer_csv_path)
            else:
                print(f"ERROR: Customer CSV file not found at {customer_csv_path}")
            print(f"Customer import process finished.")

        elif IMPORT_TARGET == 'sales':
            print(f"Importing SALES from: {sales_csv_path}")
            if os.path.exists(sales_csv_path):
                import_sales_from_csv(sales_csv_path)
            else:
                print(f"ERROR: Sales CSV file not found at {sales_csv_path}")
            print(f"Sales import process finished.")

        elif IMPORT_TARGET == 'all':
            print(f"--- Starting ALL imports ---")
            print(f"Importing PRODUCTS from: {product_csv_path}")
            if os.path.exists(product_csv_path): import_products_from_csv(product_csv_path)
            else: print(f"Product CSV not found: {product_csv_path}")
            print("Product import finished.")
            
            print(f"Importing CUSTOMERS from: {customer_csv_path}")
            if os.path.exists(customer_csv_path): import_customers_from_csv(customer_csv_path)
            else: print(f"Customer CSV not found: {customer_csv_path}")
            print("Customer import finished.")

            print(f"Importing SALES from: {sales_csv_path}")
            if os.path.exists(sales_csv_path): import_sales_from_csv(sales_csv_path)
            else: print(f"Sales CSV not found: {sales_csv_path}")
            print("Sales import finished.")
            print(f"--- ALL imports completed ---")
            
        else:
            print(f"Unsupported IMPORT_TARGET: {IMPORT_TARGET}. Supported targets: 'products', 'customers', 'sales', 'all'.")