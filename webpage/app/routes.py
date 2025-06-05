from flask import Blueprint, render_template, abort, current_app, send_from_directory
from .models import Item, Category, Photo
import os
from sqlalchemy.sql.expression import func
from . import db

web_bp = Blueprint('web_bp', __name__,
                     template_folder='../templates', # Adjusted path if templates are in web_frontend/templates
                     static_folder='../static',
                     static_url_path='/web_bp_static') # Explicitly set static_url_path

def get_product_image_url(base_filename, size_suffix=None):
    if not base_filename:
        return None
    name, ext = os.path.splitext(base_filename)
    suffixed_filename = f"{name}{size_suffix or ''}{ext}"
    return current_app.url_for('web_bp.serve_main_app_upload', filename=suffixed_filename)

@web_bp.app_context_processor
def inject_image_url_helper():
    return dict(get_product_image_url=get_product_image_url)

@web_bp.route('/uploads_main_app/<path:filename>')
def serve_main_app_upload(filename):
    upload_folder = current_app.config['MAIN_APP_UPLOAD_FOLDER']
    # Basic security: prevent path traversal. 
    if ".." in filename or filename.startswith("/"):
        abort(404)
    return send_from_directory(upload_folder, filename)

@web_bp.route('/')
def home():
    categories = Category.query.filter(Category.parent_id.is_(None)).order_by(Category.name).all() # Top-level categories
    
    # Logic to select random items, prioritizing those with images
    has_image_expression = db.session.query(Photo.id).filter(
        Photo.item_id == Item.id, 
        Photo.image_url.isnot(None), 
        Photo.image_url != ""
    ).exists()

    some_of_our_items = Item.query.filter(
        Item.show_on_website == True, 
        Item.is_active == True,
        Item.is_current_version == True 
    ).order_by(
        has_image_expression.desc(), # True (has image) comes before False
        func.rand() # For MySQL, use func.rand(). For PostgreSQL/SQLite, use func.random()
    ).limit(15).all()
    
    return render_template('home_web.html', categories=categories, some_of_our_items=some_of_our_items)

@web_bp.route('/category/<int:category_id>')
def category_page(category_id):
    category = Category.query.get_or_404(category_id)
    
    # Fetch subcategories
    sub_categories_with_items = []
    if category.children: # Assuming 'children' is the relationship name for subcategories
        for sub_cat in category.children:
            has_image_expression_sub = db.session.query(Photo.id).filter(
                Photo.item_id == Item.id, 
                Photo.image_url.isnot(None), 
                Photo.image_url != ""
            ).exists()
            
            sample_items = Item.query.filter(
                Item.category_id == sub_cat.id,
                Item.show_on_website == True,
                Item.is_active == True,
                Item.is_current_version == True
            ).order_by(
                has_image_expression_sub.desc(),
                func.rand()
            ).limit(4).all()
            
            if sample_items: # Only add subcategory if it has items to show based on criteria
                sub_categories_with_items.append({'sub_category': sub_cat, 'items': sample_items})

    # Fetch direct items for the category (optional, or as fallback)
    # For now, the logic focuses on subcategories if they exist as per request.
    # If you want to show direct items as well, this part needs to be adjusted.
    direct_items = []
    if not sub_categories_with_items: # Or if you always want to show direct items as well
        has_image_expression_direct = db.session.query(Photo.id).filter(
            Photo.item_id == Item.id, 
            Photo.image_url.isnot(None), 
            Photo.image_url != ""
        ).exists()
        direct_items = Item.query.filter(
            Item.category_id == category_id, 
            Item.show_on_website == True, 
            Item.is_active == True,
            Item.is_current_version == True
        ).order_by(
            has_image_expression_direct.desc(),
            func.rand() # Or Item.title if random is not desired here
        ).all() # You might want to limit this too

    return render_template('category_web.html', 
                           category=category, 
                           sub_categories_with_items=sub_categories_with_items, 
                           direct_items=direct_items)

@web_bp.route('/product/<int:item_id>')
def product_page(item_id):
    item = Item.query.filter(Item.id == item_id, Item.show_on_website == True, Item.is_active == True).first_or_404()
    # Eagerly load photos if you access them directly in the template often
    # item = Item.query.options(db.joinedload(Item.photos)).filter(Item.id == item_id, Item.show_on_website == True, Item.is_active == True).first_or_404()
    return render_template('product_web.html', item=item)

# It would be good to have a helper for image URLs, assuming they are stored relative to a main app's UPLOAD_FOLDER
# For example, if image_url in Photo model is like 'item_1_photo.jpg' 
# and main app serves it from /static/uploads/item_1_photo.jpg
# This frontend might need to know the base path or have a way to resolve these URLs.
# For now, we assume image_url is a complete path or handled by template. 