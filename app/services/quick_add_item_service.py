from app import db
from app.models import QuickAddItem, Item # Item might be needed for eager loading or joining if we expand to_dict
from sqlalchemy.orm import joinedload

class QuickAddItemService:

    @staticmethod
    def get_quick_add_items_by_page(page_number):
        """Fetches quick add items for a specific page, ordered by position."""
        try:
            # Eager load the related Item object to avoid N+1 queries when accessing item.sku or item.price
            items = QuickAddItem.query.options(joinedload(QuickAddItem.item)) \
                                      .filter_by(page_number=page_number) \
                                      .order_by(QuickAddItem.position.asc()) \
                                      .all()
            return [item.to_dict() for item in items]
        except Exception as e:
            # Log error e.g., current_app.logger.error(f"Error fetching quick add items for page {page_number}: {e}")
            print(f"Error fetching quick add items for page {page_number}: {e}") # Basic print for now
            return []

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
    def reorder_quick_add_items(page_number, ordered_ids):
        """Reorders quick add items for a specific page based on a list of their IDs."""
        try:
            # Fetch all items for the page first to ensure we are working with a consistent set
            items_on_page = QuickAddItem.query.filter_by(page_number=page_number).all()
            item_map = {item.id: item for item in items_on_page}

            if len(ordered_ids) != len(items_on_page):
                # This could happen if an item was added/deleted since client fetched
                # Or if client sends a partial list. For robustness, might need a strategy.
                # For now, assume client sends all current item IDs for that page in new order.
                print(f"Warning: Mismatch in item count for reorder. Client: {len(ordered_ids)}, Server: {len(items_on_page)} for page {page_number}")
                # Consider raising an error or attempting a best-effort reorder if requirements allow.
                # If counts mismatch, it's very likely some IDs sent by client won't be in item_map.

            updated_items = []
            for index, item_id_str in enumerate(ordered_ids):
                try:
                    item_id = int(item_id_str) # Convert string ID from client to int
                except ValueError:
                    print(f"Warning: Could not convert item_id '{item_id_str}' to int during reorder. Skipping.")
                    continue # Skip this ID if it's not a valid integer
                
                if item_id in item_map:
                    item_to_update = item_map[item_id]
                    if item_to_update.position != index:
                        item_to_update.position = index
                        updated_items.append(item_to_update)
                else:
                    # This item_id is not on this page according to server, or not found
                    print(f"Warning: Item ID {item_id} (from client list) not found in server's item_map for page {page_number}.")
                    # This is where the original warnings are coming from.
                    # This situation implies the client's view of the page is out of sync
                    # or it sent an ID that genuinely doesn't belong/exist.
            
            # If updated_items is empty after processing, it means either:
            # 1. No actual position changes were needed for the items found.
            # 2. None of the IDs sent by the client were found in the item_map (e.g., due to count mismatch and all IDs being new/unexpected)
            if not updated_items and len(ordered_ids) > 0 : # Check if ordered_ids was not empty to begin with
                 # Check if this is because all items were simply not found vs. genuinely no reorder needed
                all_client_ids_found = True
                for item_id_str_check in ordered_ids:
                    try:
                        if int(item_id_str_check) not in item_map:
                            all_client_ids_found = False
                            break
                    except ValueError:
                        all_client_ids_found = False # Invalid ID format from client
                        break
                
                if not all_client_ids_found:
                    # This implies a significant discrepancy. The message should reflect this.
                    # The current message "No reordering necessary..." might be misleading in this case.
                    # However, for now, the logic proceeds, and if no items are updated, it commits nothing.
                    # A more robust solution might raise an error here if critical IDs are missing.
                    pass # Existing logic handles this by not updating anything if no valid items are processed.

            # Original check: 
            # if not updated_items and len(ordered_ids) == len(items_on_page):
            # This condition (len(ordered_ids) == len(items_on_page)) might be too strict if we allow partial matches
            # A simpler check if nothing was updated:
            if not updated_items:
                return {"message": "No items were updated. This could be due to no changes in order, or discrepancies in item lists.", "updated_count": 0}

            db.session.commit()
            return {"message": f"Successfully reordered {len(updated_items)} items on page {page_number}.", "updated_count": len(updated_items)}
        except Exception as e:
            db.session.rollback()
            print(f"Error reordering quick add items for page {page_number}: {e}")
            raise e

    # Placeholder for update and delete methods if an admin interface is built
    # @staticmethod
    # def update_quick_add_item(item_id, data):
    #     pass

    # @staticmethod
    # def delete_quick_add_item(item_id):
    #     pass 