from app import db
from app.models import QuickAddItem, Item # Item might be needed for eager loading or joining if we expand to_dict
from sqlalchemy.orm import selectinload
from flask import current_app

class QuickAddItemService:

    @staticmethod
    def get_quick_add_items_by_page(page_number):
        """Fetches all quick add items for a specific page, ordered by position."""
        try:
            query = QuickAddItem.query \
                .filter(QuickAddItem.page_number == page_number) \
                .options(
                    selectinload(QuickAddItem.item) # Eagerly load the related Item
                    .selectinload(Item.photos)    # Then, from that Item, eagerly load its Photos
                ) \
                .order_by(QuickAddItem.position.asc())
            
            results = query.all()
            
            # The to_dict method in QuickAddItem model should handle serialization,
            # including cases where item might be None (for page_links or if an item was deleted)
            # or if item.is_active/is_current_version is False (to_dict can reflect this if needed)
            return [item.to_dict() for item in results]
        except Exception as e:
            current_app.logger.error(f"Error fetching quick add items for page {page_number}: {e}")
            return [] # Return empty list on error to prevent breaking frontend

    @staticmethod
    def create_quick_add_item(data):
        """Creates a new quick add item. Backend determines position."""
        try:
            # Basic validation (can be expanded)
            required_fields = ['page_number', 'type', 'label'] # Position removed
            for field in required_fields:
                if field not in data or data[field] is None:
                    raise ValueError(f"Missing required field: {field}")

            if data['type'] == 'item' and not data.get('item_id'):
                raise ValueError("item_id is required for type 'item'")
            if data['type'] == 'page_link' and not data.get('target_page_number'):
                raise ValueError("target_page_number is required for type 'page_link'")

            # Ensure item_id exists if provided
            if data.get('item_id'):
                item = Item.query.get(data['item_id'])
                if not item:
                    raise ValueError(f"Item with id {data['item_id']} not found.")

            # Determine next position for the item on its page
            next_position = QuickAddItem.query.filter_by(page_number=data['page_number']).count()

            new_quick_add = QuickAddItem(
                page_number=data['page_number'],
                position=next_position, # Backend sets position
                type=data['type'],
                label=data['label'],
                item_id=data.get('item_id'),
                item_parent_id=data.get('item_parent_id'),
                target_page_number=data.get('target_page_number'),
                color=data.get('color')
            )
            db.session.add(new_quick_add)
            db.session.commit()
            return new_quick_add.to_dict()
        except ValueError as ve:
            db.session.rollback()
            print(f"Validation Error: {ve}")
            raise ve # Re-raise for the route to catch and return a 400
        except Exception as e:
            db.session.rollback()
            print(f"Error creating quick add item: {e}")
            raise e # Re-raise for the route to catch

    @staticmethod
    def update_quick_add_item(quick_add_item_id, data):
        """Updates an existing quick add item."""
        try:
            qai = QuickAddItem.query.get(quick_add_item_id)
            if not qai:
                raise ValueError(f"QuickAddItem with id {quick_add_item_id} not found.")

            # Update fields if provided in data
            if 'label' in data: qai.label = data['label']
            if 'color' in data: qai.color = data['color'] # Add validation for hex color if needed
            if 'page_number' in data: qai.page_number = data['page_number']
            if 'position' in data: qai.position = data['position']
            if 'type' in data: qai.type = data['type'] # Be careful changing type, ensure consistency
            if 'item_parent_id' in data: qai.item_parent_id = data['item_parent_id']
            
            if qai.type == 'item':
                if 'item_id' in data: # Allow changing the linked item
                    if data['item_id'] is not None:
                        item = Item.query.get(data['item_id'])
                        if not item:
                            raise ValueError(f"Item with id {data['item_id']} not found for update.")
                        qai.item_id = data['item_id']
                        qai.target_page_number = None # Ensure target_page is cleared if type is item
                    else: # Setting item_id to None
                        qai.item_id = None 
            elif qai.type == 'page_link':
                if 'target_page_number' in data: 
                    qai.target_page_number = data['target_page_number']
                    qai.item_id = None # Ensure item_id is cleared if type is page_link
            
            # Add more validation as needed for type changes etc.

            db.session.commit()
            return qai.to_dict()
        except ValueError as ve:
            db.session.rollback()
            print(f"Validation Error updating QuickAddItem: {ve}")
            raise ve
        except Exception as e:
            db.session.rollback()
            print(f"Error updating QuickAddItem {quick_add_item_id}: {e}")
            raise e

    @staticmethod
    def delete_quick_add_item(quick_add_item_id):
        """Deletes a quick add item."""
        try:
            qai = QuickAddItem.query.get(quick_add_item_id)
            if not qai:
                # Optionally, return success if trying to delete non-existent for idempotency
                # For now, strict: raise error or return a specific indicator
                raise ValueError(f"QuickAddItem with id {quick_add_item_id} not found for deletion.")
            
            db.session.delete(qai)
            db.session.commit()
            return {"message": f"QuickAddItem {quick_add_item_id} deleted successfully."}
        except ValueError as ve: # Catch specific error if we want to return 404 vs 400
            db.session.rollback()
            print(f"Error deleting QuickAddItem: {ve}")
            raise ve
        except Exception as e:
            db.session.rollback()
            print(f"Error deleting QuickAddItem {quick_add_item_id}: {e}")
            raise e

    @staticmethod
    def reorder_quick_add_items(page_number, ordered_ids_str):
        """Reorders quick add items for a specific page based on a list of their IDs.
           Returns the full list of items for that page in their new order, or None on failure."""
        try:
            with db.session.no_autoflush:
                # Fetch all items for the page that are intended to be reordered.
                # Only consider items whose IDs are in the provided ordered_ids_str list.
                
                # Convert string IDs from client to integers for DB query
                try:
                    target_item_ids = [int(id_str) for id_str in ordered_ids_str]
                except ValueError:
                    # Handle cases where IDs are not valid integers if necessary, though frontend should send ints
                    db.session.rollback()
                    print(f"Error: Non-integer ID found in ordered_ids_str for page {page_number}")
                    return None # Or raise specific error

                # Fetch items that are on the specified page AND are in the list of IDs to be reordered
                items_to_reorder = QuickAddItem.query.filter(
                    QuickAddItem.page_number == page_number,
                    QuickAddItem.id.in_(target_item_ids)
                ).all()

                item_map = {item.id: item for item in items_to_reorder}
                
                # Verify that all IDs in ordered_ids_str correspond to items fetched for this page.
                # If an ID from ordered_ids_str is not in item_map, it means it either doesn't exist,
                # or isn't on this page_number. This could be an error condition.
                if len(target_item_ids) != len(items_to_reorder):
                    print(f"Warning: Mismatch between provided IDs ({len(target_item_ids)}) and found items ({len(items_to_reorder)}) for page {page_number}. Some IDs may be invalid or not on this page.")
                    # Potentially, we could raise an error here if strict matching is required.
                    # For now, we proceed to reorder only the items that were found.

                updated_count = 0
                for new_position, item_id in enumerate(target_item_ids):
                    if item_id in item_map:
                        item = item_map[item_id]
                        if item.position != new_position:
                            item.position = new_position
                            updated_count += 1
                    else:
                        # This ID was in ordered_ids_str but not found among items_to_reorder.
                        # This indicates a discrepancy, as noted by the warning above.
                        print(f"Skipping ID {item_id} during reorder: not found on page {page_number} or does not exist.")

            if updated_count > 0:
                db.session.commit()
            else:
                # No actual position changes occurred among the found items.
                # Or, potentially, no items were found if target_item_ids was empty or all invalid.
                db.session.rollback() # No changes to commit
                print(f"No position updates made for Quick Add Items on page {page_number}.")

            # After potential commit, fetch all items for the page again to return them in the new order
            final_ordered_items = QuickAddItem.query.options(selectinload(QuickAddItem.item)) \
                                          .filter_by(page_number=page_number) \
                                          .order_by(QuickAddItem.position.asc()) \
                                          .all()
            return final_ordered_items

        except Exception as e:
            db.session.rollback()
            print(f"Error reordering quick add items for page {page_number}: {e}")
            # Consider logging the error: current_app.logger.error(...)
            return None # Indicate failure to the route

    # Placeholder for update and delete methods if an admin interface is built
    # @staticmethod
    # def update_quick_add_item(item_id, data):
    #     pass

    # @staticmethod
    # def delete_quick_add_item(item_id):
    #     pass 