from app import db
from app.models.item import Item
from app.models.photo import Photo
from .image_service import ImageService
from sqlalchemy.exc import IntegrityError
import copy
import uuid
from flask import current_app
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy import or_, and_

class ItemService:
    @staticmethod
    def create_item(data, image_files=None):
        try:
            if not data.get('title') or data.get('price') is None:
                return None, "Title and Price are required fields."

            temp_sku_needed = False
            provided_sku = data.get('sku', '').strip()
            
            if provided_sku:
                # Check if this SKU is already in use by another current, active item
                existing_item_with_sku = Item.query.filter(
                    Item.sku == provided_sku,
                    Item.is_current_version == True,
                    Item.is_active == True
                ).first()
                if existing_item_with_sku:
                    return None, f"SKU '{provided_sku}' is already in use by another active item."
            else:
                temp_sku_needed = True
                provided_sku = f"TEMP_SKU_{uuid.uuid4().hex}"

            new_item = Item(
                parent_id=data.get('parent_id', -1),
                sku=provided_sku, # Use provided or temporary SKU
                title=data['title'],
                price=data['price'],
                stock_quantity=data.get('stock_quantity', 0),
                is_stock_tracked=data.get('is_stock_tracked', True),
                description=data.get('description'),
                show_on_website=data.get('show_on_website', False),
                is_active=data.get('is_active', True),
                is_current_version=True
            )
            
            db.session.add(new_item)
            db.session.commit() # Commit to save the item and get its ID

            if temp_sku_needed and new_item.id:
                # Now that we have the ID, update to the permanent SKU format
                new_item.sku = f"SKU_{new_item.id}"
                db.session.commit() # Commit the SKU update
            elif temp_sku_needed and not new_item.id:
                # This case should ideally not be reached if the first commit was successful
                # but as a safeguard:
                db.session.rollback() # Rollback potential partial item save
                return None, "Failed to retrieve item ID for SKU generation after initial save."
            
            # Process and save images
            if image_files and new_item.id:
                first_image = True
                for file_storage in image_files:
                    if file_storage and file_storage.filename: # Ensure file_storage is not empty
                        base_filename, error_msg = ImageService.save_processed_image(file_storage)
                        if base_filename:
                            new_photo = Photo(
                                item_id=new_item.id, 
                                image_url=base_filename,
                                is_primary=first_image 
                            )
                            db.session.add(new_photo)
                            first_image = False # Only the first uploaded image is primary
                        else:
                            current_app.logger.error(f"Failed to process image for item {new_item.id if new_item else 'UnknownItem'}: {file_storage.filename}. Error: {error_msg}")
                if db.session.new: # Check if there are new Photo objects to commit
                    db.session.commit() # Commit photos

            return new_item, None
        except IntegrityError as e:
            db.session.rollback()
            if temp_sku_needed and 'sku' in str(e.orig).lower(): # Unlikely with UUID but good to keep
                return None, "A temporary SKU conflict occurred. Please try again."
            # If it's not a temp SKU issue, it might be another constraint we're not expecting
            # or if the DB unique constraint was still there, it would be caught here for user-provided SKUs.
            return None, f"Database integrity error: {str(e.orig)}"
        except KeyError as e: # Catch missing required fields like sku, title, price
            db.session.rollback()
            return None, f"Missing required field: {str(e)}"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_item_by_id(item_id):
        return Item.query.filter_by(id=item_id, is_current_version=True).first()

    @staticmethod
    def get_items_for_display(filters=None):
        base_query = Item.query.filter_by(is_current_version=True, is_active=True)

        # Proceed if filters dict is not None and has at least one non-empty (non-None, non-whitespace) value
        if filters and any(str(val).strip() for val in filters.values()):
            sku_filter = filters.get('sku')
            title_query_filter = filters.get('title_query') # This is the general search term from the input

            # Priority 1: Exact SKU match.
            # If sku_filter is provided and matches an item exactly, return that item.
            # This allows finding any item (including variants) by its exact SKU.
            if sku_filter and str(sku_filter).strip():
                exact_sku_item = base_query.filter(Item.sku == sku_filter).first()
                if exact_sku_item:
                    return [exact_sku_item]
                
                # If sku_filter was provided, didn't yield an exact match, 
                # and title_query_filter is also empty or not provided,
                # it implies an SKU-only search that failed. Return empty.
                if not (title_query_filter and str(title_query_filter).strip()):
                    return []
            
            # If we reach here, it means either:
            # 1. sku_filter was not provided (or was empty).
            # 2. sku_filter was provided but found no exact match, AND title_query_filter is present and non-empty.
            # In these cases, we proceed with a general search using title_query_filter on non-variant items.
            # This search will look in both title and SKU fields using ILIKE.

            # General search is constrained to parent/standalone items.
            query = base_query.filter(db.or_(Item.parent_id == -1, Item.parent_id == -2))

            if title_query_filter and str(title_query_filter).strip():
                search_term = f"%{str(title_query_filter).strip()}%"
                query = query.filter(
                    db.or_(
                        Item.title.ilike(search_term),
                        Item.sku.ilike(search_term) # General search includes SKU with ilike
                    )
                )
            # If title_query_filter is effectively empty at this stage, the query remains filtered only by parent_id.
            # This results in listing all parent/standalone items, which is consistent with an empty general search query.

            return query.order_by(Item.title).all()

        else: # No filters, or filters were present but all values were effectively empty.
            # Default to showing all standalone or parent items.
            return base_query.filter(db.or_(Item.parent_id == -1, Item.parent_id == -2)).order_by(Item.title).all()

    @staticmethod
    def get_variants_for_parent(parent_item_id):
        """Fetches all active, current variants for a given parent item ID."""
        return Item.query.filter_by(
            parent_id=parent_item_id, 
            is_current_version=True, 
            is_active=True
        ).order_by(Item.title).all()

    @staticmethod
    def update_item(item_id, data, image_files=None):
        item_to_update = Item.query.get(item_id)
        if not item_to_update or not item_to_update.is_current_version:
            return None, "Item not found or not current version."

        # Check if SKU is being changed and if the new SKU is valid
        new_sku = data.get('sku', '').strip()
        if new_sku and new_sku != item_to_update.sku:
            existing_item_with_new_sku = Item.query.filter(
                Item.sku == new_sku,
                Item.is_current_version == True,
                Item.is_active == True,
                Item.id != item_id # Exclude the item being updated itself from the check
            ).first()
            if existing_item_with_new_sku:
                return None, f"New SKU '{new_sku}' is already in use by another active item."

        # Check if any versioned field is being updated (including SKU now)
        versioned_fields = ['parent_id', 'sku', 'title', 'description', 'price', 'show_on_website', 'is_active', 'is_stock_tracked']
        is_versioning_needed = any(field in data and getattr(item_to_update, field) != data[field] for field in versioned_fields)

        updated_item_instance = None # To store the instance that photos should be linked to

        if 'stock_quantity' in data and not is_versioning_needed and len(data.keys()) == 1:
            # Only stock_quantity is updated, no versioning needed
            try:
                item_to_update.stock_quantity = data['stock_quantity']
                db.session.commit()
                updated_item_instance = item_to_update
                # Image processing will happen after this block
            except Exception as e:
                db.session.rollback()
                return None, str(e)

        elif is_versioning_needed:
            try:
                # Create a new version
                item_to_update.is_current_version = False
                db.session.add(item_to_update) # Add to session to mark for update

                new_version_data = { 
                    f.name: getattr(item_to_update, f.name) 
                    for f in item_to_update.__table__.columns 
                    if f.name != 'id'
                }
                for key, value in data.items():
                    if key != 'id': 
                       new_version_data[key] = value
                
                new_version_data['is_current_version'] = True
                # Ensure parent_id from the original item is carried over if not in data
                if 'parent_id' not in new_version_data:
                    new_version_data['parent_id'] = item_to_update.parent_id


                new_item_version = Item(**new_version_data)

                db.session.add(new_item_version)
                db.session.commit() # Commit to get ID for new_item_version

                # === Copy photos from old version to new version ===
                if new_item_version.id and item_to_update.photos:
                    photos_copied = False
                    for old_photo in item_to_update.photos:
                        new_photo_for_version = Photo(
                            item_id=new_item_version.id, 
                            image_url=old_photo.image_url, 
                            is_primary=old_photo.is_primary 
                            # Add other photo attributes to copy if they exist e.g. alt_text
                        )
                        db.session.add(new_photo_for_version)
                        photos_copied = True
                    if photos_copied:
                        db.session.commit() # Commit the new photo records for the new version
                # === End of photo copying block ===

                updated_item_instance = new_item_version
                # Image processing for newly uploaded files will happen after this block for updated_item_instance
            except IntegrityError as e: 
                db.session.rollback()
                return None, f"Database integrity error: {str(e.orig)}"
            except Exception as e:
                db.session.rollback()
                return None, str(e)
        else:
            # Non-versioned fields or no change in versioned fields other than stock_quantity (handled above)
            if 'stock_quantity' in data:
                 item_to_update.stock_quantity = data['stock_quantity']
                 db.session.commit()
                 updated_item_instance = item_to_update
                 # Image processing will happen after this block
            else:
                # No actual data changes that require a commit, but images might still be processed.
                updated_item_instance = item_to_update 
            # If only non-versioned fields (excluding stock) changed, this path is taken.
            # If data was empty, this path is also taken.
            # If no actual field change happened, updated_item_instance is item_to_update.

        # If updated_item_instance is None here, it means an update path wasn't correctly handled
        # or an early return happened for an error. However, successful paths set it.
        if not updated_item_instance:
            # This case implies no data changes were made and no versioning occurred.
            # It might also mean an error path was missed if it should have been set.
            # For image-only updates, item_to_update is the target.
            updated_item_instance = item_to_update 

        # Process and save images if any were provided
        if image_files and updated_item_instance:
            # Check if the item (original or new version) already has a primary image
            has_primary_image = Photo.query.filter_by(item_id=updated_item_instance.id, is_primary=True).first() is not None
            
            first_new_image_can_be_primary = not has_primary_image
            made_a_new_image_primary = False

            for file_storage in image_files:
                if file_storage and file_storage.filename:
                    base_filename, error_msg = ImageService.save_processed_image(file_storage)
                    if base_filename:
                        is_this_image_primary = False
                        if first_new_image_can_be_primary and not made_a_new_image_primary:
                            is_this_image_primary = True
                            made_a_new_image_primary = True # Ensure only one new image becomes primary
                        
                        new_photo = Photo(
                            item_id=updated_item_instance.id, 
                            image_url=base_filename,
                            is_primary=is_this_image_primary
                        )
                        db.session.add(new_photo)
                    else:
                        current_app.logger.error(f"Failed to process image for item {updated_item_instance.id}: {file_storage.filename}. Error: {error_msg}")
            
            if db.session.new: # Check if there are new Photo objects to commit
                try:
                    db.session.commit()
                except Exception as e: # Catch potential commit errors for photos
                    db.session.rollback()
                    current_app.logger.error(f"Error committing new photos for item {updated_item_instance.id}: {e}")
                    # Decide if this should be a hard error for the update operation
                    # For now, log and proceed, item data update might have succeeded.

        if not updated_item_instance and not is_versioning_needed and 'stock_quantity' not in data and not image_files:
             return item_to_update, "No versionable changes detected and no new images."

        return updated_item_instance, None # Return the (potentially new version of) item

    @staticmethod
    def delete_item(item_id):
        # This should probably mark all versions of an SKU as inactive rather than deleting, 
        # or handle parent_id references carefully if it's a parent item.
        # For now, let's mark the current version as inactive.
        item = Item.query.get(item_id)
        if not item or not item.is_current_version:
            return False, "Item not found or not current version."
        try:
            item.is_active = False
            item.is_current_version = False # Or handle how deletion affects versioning
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def get_all_items(sku=None, title_query=None, is_active_filter=None):
        query = Item.query.options(selectinload(Item.photos), selectinload(Item.variants))
        
        # Current version is always implicitly part of item fetching unless stated otherwise for admin views
        query = query.filter(Item.is_current_version == True)

        if is_active_filter is not None: # Apply is_active filter if provided
            query = query.filter(Item.is_active == is_active_filter)

        if sku:
            # Prioritize exact SKU match if provided
            query = query.filter(Item.sku == sku)
        elif title_query: # Use elif to not override SKU if both somehow provided and SKU is stricter
            search_term = f"%{title_query}%"
            query = query.filter(Item.title.ilike(search_term))
        
        # Add ordering, e.g., by title or ID
        query = query.order_by(Item.title.asc())
        
        items = query.all()
        return items 