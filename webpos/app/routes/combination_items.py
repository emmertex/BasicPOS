from flask import Blueprint, request, jsonify, current_app
from app import db
from app.models import Item, CombinationItem, CombinationItemComponent # Adjusted import
import json

combination_items_bp = Blueprint('combination_items_bp', __name__)

@combination_items_bp.route('/', methods=['POST'])
def create_combination_item_route():
    try:
        data = request.form
        title = data.get('title')
        description = data.get('description')
        components_json = data.get('components', '[]')
        
        if not title:
            return jsonify({'success': False, 'message': 'Title is required'}), 400
        
        components = json.loads(components_json)
        if not components:
            return jsonify({'success': False, 'message': 'At least one component is required'}), 400

        # Create the base item for the combination product itself
        # This item will have parent_id = -3 to signify it's a combination item type
        base_item = Item(
            parent_id=-3, 
            title=title,
            description=description,
            is_stock_tracked=False, # Typically, stock is tracked by components, not the combo itself
            price=0, # Price might be calculated from components or set separately
            is_active=True,
            is_current_version=True 
            # category_id might be relevant here if combos belong to categories
        )
        db.session.add(base_item)
        db.session.flush()  # Get the base_item.id

        # Create the CombinationItem link
        combination_item_record = CombinationItem(item_id=base_item.id)
        db.session.add(combination_item_record)
        db.session.flush() # Get the combination_item_record.id

        # Add components
        for comp_data in components:
            component_item_id = comp_data.get('item_id')
            quantity = comp_data.get('quantity')

            if not component_item_id or not quantity:
                db.session.rollback()
                return jsonify({'success': False, 'message': 'Invalid component data'}), 400
            
            # Verify the component item exists
            component_exists = Item.query.get(component_item_id)
            if not component_exists:
                db.session.rollback()
                return jsonify({'success': False, 'message': f'Component item with ID {component_item_id} not found'}), 404

            component = CombinationItemComponent(
                combination_item_id=combination_item_record.id,
                component_item_id=component_item_id,
                quantity=quantity
            )
            db.session.add(component)
        
        db.session.commit()
        # Return the ID of the base_item, as this is what the frontend usually interacts with
        return jsonify({'success': True, 'message': 'Combination item created successfully', 'id': base_item.id, 'combination_id': combination_item_record.id}), 201
    except json.JSONDecodeError:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Invalid JSON format for components'}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating combination item: {str(e)}")
        return jsonify({'success': False, 'message': f'An error occurred: {str(e)}'}), 500

@combination_items_bp.route('/<int:base_item_id>', methods=['GET'])
def get_combination_item_route(base_item_id):
    # base_item_id is the ID of the Item record where parent_id = -3
    combo_item_entry = CombinationItem.query.filter_by(item_id=base_item_id).first()
    
    if not combo_item_entry:
        return jsonify({'success': False, 'message': 'Combination item not found'}), 404
    
    base_item = Item.query.get(base_item_id)
    if not base_item: # Should not happen if combo_item_entry exists due to FK, but good check
        return jsonify({'success': False, 'message': 'Base item for combination not found'}), 404

    components_data = []
    for component_obj in combo_item_entry.components:
        component_item_record = Item.query.get(component_obj.component_item_id)
        if component_item_record:
            components_data.append({
                'item_id': component_obj.component_item_id,
                'title': component_item_record.title, # Assuming Item model has a title
                'sku': component_item_record.sku,     # Assuming Item model has an sku
                'quantity': component_obj.quantity
            })
    
    return jsonify({
        'success': True,
        'id': base_item.id, # This is the ID of the 'Item' that is the combo
        'title': base_item.title,
        'description': base_item.description,
        'components': components_data,
        'combination_record_id': combo_item_entry.id # ID of the combination_items table itself
    })

@combination_items_bp.route('/<int:base_item_id>', methods=['PUT'])
def update_combination_item_route(base_item_id):
    try:
        data = request.form
        title = data.get('title')
        description = data.get('description')
        components_json = data.get('components', '[]')

        if not title:
            return jsonify({'success': False, 'message': 'Title is required'}), 400
        
        components = json.loads(components_json)
        # Allow empty components list if user wants to remove all, but usually at least one is needed
        # if not components: 
        #     return jsonify({'success': False, 'message': 'At least one component is required'}), 400

        base_item = Item.query.get(base_item_id)
        if not base_item or base_item.parent_id != -3:
            return jsonify({'success': False, 'message': 'Combination item (base) not found or not a combination type'}), 404

        combo_item_record = CombinationItem.query.filter_by(item_id=base_item_id).first()
        if not combo_item_record:
             return jsonify({'success': False, 'message': 'Combination item details not found'}), 404

        # Update base item details
        base_item.title = title
        base_item.description = description
        
        # Remove existing components for this combination item
        CombinationItemComponent.query.filter_by(combination_item_id=combo_item_record.id).delete()
        
        # Add new components
        for comp_data in components:
            component_item_id = comp_data.get('item_id')
            quantity = comp_data.get('quantity')

            if not component_item_id or not quantity:
                db.session.rollback()
                return jsonify({'success': False, 'message': 'Invalid component data'}), 400

            component_exists = Item.query.get(component_item_id)
            if not component_exists:
                db.session.rollback()
                return jsonify({'success': False, 'message': f'Component item with ID {component_item_id} not found'}), 404

            new_component = CombinationItemComponent(
                combination_item_id=combo_item_record.id,
                component_item_id=component_item_id,
                quantity=quantity
            )
            db.session.add(new_component)
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Combination item updated successfully', 'id': base_item.id})
    except json.JSONDecodeError:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Invalid JSON format for components'}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating combination item {base_item_id}: {str(e)}")
        return jsonify({'success': False, 'message': f'An error occurred: {str(e)}'}), 500

@combination_items_bp.route('/<int:base_item_id>', methods=['DELETE'])
def delete_combination_item_route(base_item_id):
    try:
        base_item = Item.query.get(base_item_id)
        if not base_item or base_item.parent_id != -3:
            return jsonify({'success': False, 'message': 'Combination item (base) not found or not a combination type'}), 404

        combo_item_record = CombinationItem.query.filter_by(item_id=base_item_id).first()
        if not combo_item_record: # Should exist if base_item with parent_id -3 exists and FK is proper
             return jsonify({'success': False, 'message': 'Combination item details not found, cannot delete components'}), 404
        
        # Deleting the CombinationItem record will cascade delete its components
        # due to cascade="all, delete-orphan" on the relationship.
        db.session.delete(combo_item_record)
        # Then delete the base Item record itself
        db.session.delete(base_item)
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Combination item deleted successfully'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting combination item {base_item_id}: {str(e)}")
        return jsonify({'success': False, 'message': f'An error occurred: {str(e)}'}), 500 