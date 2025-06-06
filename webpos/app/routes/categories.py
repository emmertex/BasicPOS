from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from app import db
from app.models.category import Category
from app.models.item import Item

bp = Blueprint('categories', __name__)

def get_category_tree():
    """Helper function to build a hierarchical category tree."""
    all_categories = Category.query.order_by(Category.name).all()
    category_map = {c.id: c for c in all_categories}
    root_categories = []

    # First, initialize children_list on every category object to ensure it exists.
    for category in all_categories:
        category.children_list = []

    # Then, populate the children_list for each parent.
    for category in all_categories:
        if category.parent_id is None:
            root_categories.append(category)
        else:
            if category.parent_id in category_map:
                parent = category_map[category.parent_id]
                parent.children_list.append(category)

    # The initial query sorts all categories, which is good, but let's ensure children are also sorted.
    for category in all_categories:
        category.children_list.sort(key=lambda x: x.name)
    
    # Sort the top-level categories as well
    root_categories.sort(key=lambda x: x.name)

    return root_categories

@bp.route('/', methods=['GET'])
def category_list():
    """Renders the main category management page."""
    categories_tree = get_category_tree()
    all_categories = Category.query.order_by(Category.name).all()
    return render_template('category_management.html', 
                           categories_tree=categories_tree, 
                           all_categories=all_categories)

@bp.route('/add', methods=['POST'])
def add_category():
    """Handles adding a new category."""
    name = request.form.get('name')
    parent_id = request.form.get('parent_id')
    if not name:
        # In a real app, you'd use flash messages
        return redirect(url_for('categories.category_list'))

    new_category = Category(
        name=name,
        parent_id=int(parent_id) if parent_id else None
    )
    db.session.add(new_category)
    db.session.commit()
    return redirect(url_for('categories.category_list'))

@bp.route('/update_parent/<int:category_id>', methods=['POST'])
def update_parent(category_id):
    """Handles updating a category's parent, checking for circular references."""
    data = request.get_json()
    new_parent_id = data.get('parent_id')

    category_to_update = Category.query.get(category_id)
    if not category_to_update:
        return jsonify({"success": False, "error": "Category not found"}), 404

    # Circular reference check
    if new_parent_id is not None:
        if new_parent_id == category_to_update.id:
            return jsonify({"success": False, "error": "A category cannot be its own parent."}), 400
        
        # Traverse up from the new parent to see if we find the category being moved
        current = Category.query.get(new_parent_id)
        while current:
            if current.id == category_to_update.id:
                return jsonify({"success": False, "error": "Circular reference detected."}), 400
            current = current.parent

    category_to_update.parent_id = new_parent_id
    db.session.commit()
    return jsonify({"success": True})

@bp.route('/delete/<int:category_id>', methods=['POST'])
def delete_category(category_id):
    """Handles deleting a category and reassigning its items."""
    data = request.get_json()
    target_category_id = data.get('target_category_id')

    category_to_delete = Category.query.get(category_id)
    if not category_to_delete:
        return jsonify({"success": False, "error": "Category not found."}), 404

    # Reassign items to the target category
    Item.query.filter_by(category_id=category_id).update({'category_id': target_category_id})
    
    # Make children of the deleted category top-level
    Category.query.filter_by(parent_id=category_id).update({'parent_id': None})

    db.session.delete(category_to_delete)
    db.session.commit()
    
    return jsonify({"success": True}) 