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
    VERSIONABLE_FIELDS = [ 'title', 'price' ]

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
                photos_added_to_session = False
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
                            photos_added_to_session = True
                            first_image = False # Only the first uploaded image is primary
                        else:
                            current_app.logger.error(f"Failed to process image for item {new_item.id if new_item else 'UnknownItem'}: {file_storage.filename}. Error: {error_msg}")
                
                if photos_added_to_session: # Commit only if new photos were actually added to session
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
    def find_parent_definition_by_id(item_id):
        """Fetches an item by ID, expecting it to be an active parent item (parent_id == -2). 
        Does not strictly require is_current_version=True for the parent placeholder itself.
        """
        current_app.logger.info(f"[ItemService.find_parent_definition_by_id] Searching for parent definition with ID: {item_id}")
        item = Item.query.filter_by(id=item_id, parent_id=-2, is_active=True).first()
        if item:
            current_app.logger.info(f"[ItemService.find_parent_definition_by_id] Found parent item: ID={item.id}, Title='{item.title}', parent_id={item.parent_id}, is_active={item.is_active}")
        else:
            current_app.logger.warning(f"[ItemService.find_parent_definition_by_id] No active parent item with parent_id=-2 found for ID: {item_id}")
        return item

    @staticmethod
    def get_items_for_display(filters=None, limit=None):
        base_query = Item.query.filter_by(is_current_version=True, is_active=True)
        items_to_return = [] # Initialize to ensure it's always a list

        title_query_filter = filters.get('title_query') if filters else None
        search_term = f"%{str(title_query_filter).strip()}%" if title_query_filter and str(title_query_filter).strip() else None

        # Determine if an exact SKU search is being performed
        sku_filter = filters.get('sku') if filters else None
        if sku_filter and str(sku_filter).strip():
            exact_sku_item = base_query.filter(Item.sku == sku_filter).first()
            if exact_sku_item:
                return [exact_sku_item] # Exact SKU match returns immediately
            if not search_term: # If only SKU was provided and not found, return empty
                return []

        # If no search term by this point, and no exact SKU match, behavior might depend on include_variants
        # For now, assume a search term is generally expected if not an exact SKU hit.

        include_variants_flag = filters.get('include_variants', False) if filters else False

        if include_variants_flag:
            # Path for 'Create Combination Item' modal (include_variants == true)
            # Should NOT auto-expand parent variants here.
            # Returns direct matches: standalones (-1), parents (-2), variants (>0).
            # Frontend will filter (e.g., show -1, -2) and handle parent selection by opening variant modal.
            
            active_query = base_query.filter(
                db.or_(
                    Item.parent_id == -1,  # Standalone items
                    Item.parent_id == -2,  # Parent items
                    Item.parent_id > 0     # Variants
                )
            )
            if search_term:
                active_query = active_query.filter(
                    db.or_(
                        Item.title.ilike(search_term),
                        Item.sku.ilike(search_term)
                    )
                )
            query_to_execute = active_query.order_by(Item.title)
            if limit is not None and isinstance(limit, int) and limit > 0:
                query_to_execute = query_to_execute.limit(limit)
            items_to_return = query_to_execute.all()

        else:
            # Path for 'Main Item Search' (include_variants == false or not provided)
            # Should auto-expand parent items into their variants if parent matches search.
            # Also include matching standalones (-1) and combos (-3).
            
            direct_matches_list = []
            if search_term:
                # Initial query for items directly matching by title or SKU
                # This includes standalones (-1), parents (-2), variants (>0), combos (-3) initially.
                matching_items_query = base_query.filter(
                    db.or_(
                        Item.title.ilike(search_term),
                        Item.sku.ilike(search_term)
                    )
                )
                direct_matches_list = matching_items_query.all()
            elif not sku_filter : # No search term and no SKU filter means get all relevant items
                 # Show standalones (-1), parents (-2), combos (-3) by default without search term
                all_items_query = base_query.filter(
                     db.or_(
                        Item.parent_id == -1,
                        Item.parent_id == -2,
                        Item.parent_id == -3
                    )
                ).order_by(Item.title)
                if limit is not None and isinstance(limit, int) and limit > 0:
                    all_items_query = all_items_query.limit(limit)
                return all_items_query.all()


            # Process direct matches: separate into displayable items and parents whose variants we need
            items_for_display = []
            matched_ids = set()
            parent_ids_to_fetch_variants_for = set()

            for item in direct_matches_list:
                if item.id in matched_ids:
                    continue
                
                # Add combos (-3) and standalones (-1) directly
                if item.parent_id == -3 or item.parent_id == -1:
                    items_for_display.append(item)
                    matched_ids.add(item.id)
                # If a parent (-2) matches directly, add it and mark for variant fetching
                elif item.parent_id == -2:
                    items_for_display.append(item) # Add the parent itself
                    matched_ids.add(item.id)
                    parent_ids_to_fetch_variants_for.add(item.id)
                # If a variant (>0) matches directly, add it. Also find its parent if that parent wasn't already processed.
                elif item.parent_id > 0:
                    items_for_display.append(item)
                    matched_ids.add(item.id)
                    # If this variant's parent also matches the search term (or should be included),
                    # it would have been caught as a parent_id == -2.
                    # For simplicity here, we are not adding the parent if only the variant matched,
                    # unless the parent *also* directly matched the search_term.
                    # The more robust parent-variant expansion is below.

            # Find additional parent items (-2) that match the search term,
            # whose variants should be fetched, even if the parent wasn't in direct_matches_list yet
            # (e.g. if search term was very specific to a variant of a non-matching parent title) -
            # No, this is simpler: if a parent title matches, fetch its variants.
            if search_term:
                additional_matching_parents_query = base_query.filter(
                    Item.parent_id == -2,
                    db.or_(
                        Item.title.ilike(search_term),
                        Item.sku.ilike(search_term)
                    )
                )
                for parent in additional_matching_parents_query.all():
                    parent_ids_to_fetch_variants_for.add(parent.id)
                    if parent.id not in matched_ids: # Add parent if not already there
                        items_for_display.append(parent)
                        matched_ids.add(parent.id)
            
            # Fetch and add variants for all identified parent IDs
            if parent_ids_to_fetch_variants_for:
                variants_query = Item.query.filter(
                    Item.parent_id.in_(list(parent_ids_to_fetch_variants_for)),
                    Item.is_current_version == True,
                    Item.is_active == True
                )
                for variant in variants_query.all():
                    if variant.id not in matched_ids:
                        items_for_display.append(variant)
                        matched_ids.add(variant.id)
            
            # Sort the final list
            items_for_display.sort(key=lambda x: (x.title or "").lower())
            
            # Apply limit if specified (after all items are gathered and sorted)
            if limit is not None and isinstance(limit, int) and limit > 0:
                items_to_return = items_for_display[:limit]
            else:
                items_to_return = items_for_display
        
        return items_to_return

    @staticmethod
    def get_variants_for_parent(parent_item_id):
        """Fetches all active, current variants for a given parent item ID."""
        return Item.query.filter_by(
            parent_id=parent_item_id, 
            is_current_version=True, 
            is_active=True
        ).order_by(Item.title).all()

    @staticmethod
    def has_active_current_variants(parent_item_id):
        """Checks if a parent item has any active, current variants."""
        return db.session.query(Item.id).filter_by(
            parent_id=parent_item_id, 
            is_current_version=True, 
            is_active=True
        ).first() is not None

    @staticmethod
    def update_item(item_id, data, image_files=None):
        item_to_update = Item.query.get(item_id)
        if not item_to_update:
            return None, "Item not found."
        if not item_to_update.is_current_version:
            # This case should ideally be prevented by UI logic, 
            # but as a safeguard for direct API calls:
            return None, "Cannot update an old version of an item. Please update the current version."

        # Determine if a new version needs to be created
        create_new_version = False
        versionable_changes = {}
        
        # Use the class-level constant
        for field in ItemService.VERSIONABLE_FIELDS:
            if field in data and getattr(item_to_update, field) != data[field]:
                create_new_version = True
                versionable_changes[field] = data[field]
        
        # Image changes also trigger a new version if versionable fields are also changing,
        # or if configured to always version on image change.
        # For now, let's assume new images on their own don't force a new version unless other versionable fields change.
        # If versioning on image change is desired, add: if image_files: create_new_version = True

        # if image_files and not create_new_version:
            # If only images changed, and we decided this means no new version,
            # process images on current item, then return.
            # ImageService.process_and_associate_images(item_to_update.id, image_files, data.get('photos_to_delete'))
            # db.session.commit()
            # return item_to_update, None

        if create_new_version:
            try:
                # Create a new version
                item_to_update.is_current_version = False
                # Deactivate and clear other attributes so the historical record does not
                # appear anywhere it shouldn't.
                item_to_update.is_active = False
                item_to_update.show_on_website = False
                item_to_update.is_stock_tracked = False
                item_to_update.stock_quantity = 0
                item_to_update.category_id = None

                db.session.add(item_to_update)  # mark for update

                new_version_data = { 
                    f.name: getattr(item_to_update, f.name) 
                    for f in item_to_update.__table__.columns 
                    if f.name != 'id'
                }
                for key, value in versionable_changes.items():
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
            # Non-versioned fields or no change in versioned fields
            # Iterate through all data provided and update the item_to_update
            updated_fields = False
            for key, value in data.items():
                if hasattr(item_to_update, key) and getattr(item_to_update, key) != value:
                    setattr(item_to_update, key, value)
                    updated_fields = True
            
            if updated_fields:
                db.session.add(item_to_update) # Add to session to mark for update
                db.session.commit()
            
            updated_item_instance = item_to_update
            # If only non-versioned fields changed, this path is taken.
            # If data was empty or no actual field change happened, updated_item_instance is item_to_update.

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

        if not updated_item_instance and not create_new_version and 'stock_quantity' not in data and not image_files:
             return item_to_update, "No versionable changes detected and no new images."

        return updated_item_instance, None # Return the (potentially new version of) item

    @staticmethod
    def delete_item(item_id):
        item_to_delete = Item.query.get(item_id)
        if not item_to_delete:
            return False, "Item not found."
        # If you want to restrict deletion to only current_version items, uncomment next line
        # if not item_to_delete.is_current_version:
        #     return False, "Item not found or not current version."

        try:
            original_parent_id_of_deleted_item = item_to_delete.parent_id
            original_item_id = item_to_delete.id # for logging clarity

            item_to_delete.is_active = False
            item_to_delete.is_current_version = False 
            db.session.add(item_to_delete)

            parent_updated_to_standalone = False
            if original_parent_id_of_deleted_item and original_parent_id_of_deleted_item > 0:
                # This item was a variant. Check its parent.
                parent_item_object = Item.query.get(original_parent_id_of_deleted_item)
                if parent_item_object and parent_item_object.parent_id == -2: 
                    # The parent is indeed a 'parent placeholder' item.
                    # Check for other active, current variants of this parent.
                    # The item being deleted is now marked is_active=False, is_current_version=False,
                    # so it won't be included in this check.
                    has_other_active_current_variants = Item.query.filter(
                        Item.parent_id == original_parent_id_of_deleted_item,
                        Item.is_active == True,
                        Item.is_current_version == True
                    ).first() is not None

                    if not has_other_active_current_variants:
                        parent_item_object.parent_id = -1 # Convert parent to standalone
                        db.session.add(parent_item_object)
                        parent_updated_to_standalone = True
                        current_app.logger.info(f"Parent item ID {parent_item_object.id} had its parent_id set to -1 as its last variant (item ID {original_item_id}) was deleted/deactivated.")
            
            db.session.commit()
            msg = f"Item {original_item_id} marked as inactive/non-current."
            if parent_updated_to_standalone:
                msg += f" Parent {original_parent_id_of_deleted_item} updated to standalone."
            current_app.logger.info(msg)
            return True, None
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error in delete_item for item ID {item_id}: {e}")
            return False, str(e)

    # Removed ItemService.get_all_items method as it appears to be unused.
    # get_items_for_display is the primary method for fetching items with display logic.

    # If any other static methods exist in ItemService, they would continue here. 