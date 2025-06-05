from app import db
from sqlalchemy.dialects.mysql import INTEGER
import os # Import os for path manipulation

class QuickAddItem(db.Model):
    __tablename__ = 'quick_add_items'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    page_number = db.Column(db.Integer, nullable=False, default=1)
    position = db.Column(db.Integer, nullable=False) # 0-indexed position on the grid for a given page
    
    type = db.Column(db.String(50), nullable=False)  # 'item' or 'page_link'
    label = db.Column(db.String(100), nullable=False)
    
    item_id = db.Column(db.Integer, db.ForeignKey('Items.id'), nullable=True)
    item = db.relationship('Item', backref=db.backref('quick_add_references', lazy=True))
    
    item_parent_id = db.Column(db.Integer, nullable=True) # Stores parent_id of the item, if applicable
    
    target_page_number = db.Column(INTEGER(unsigned=True), nullable=True) # Target page if type is 'page_link'
    
    color = db.Column(db.String(7), nullable=True)  # Hex color code, e.g., #RRGGBB

    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def to_dict(self):
        primary_photo_small_url = None
        item_instance = getattr(self, 'item', None) # Safely get item

        if self.type == 'item' and item_instance and item_instance.photos:
            photo_to_process = None
            # Find primary photo
            for p in item_instance.photos:
                if p.is_primary:
                    photo_to_process = p
                    break
            # If no primary, take the first photo
            if not photo_to_process and item_instance.photos:
                photo_to_process = item_instance.photos[0]

            if photo_to_process and hasattr(photo_to_process, 'image_url') and photo_to_process.image_url:
                base_filename = photo_to_process.image_url
                name, ext = os.path.splitext(base_filename)
                if ext: # Ensure there is an extension
                    primary_photo_small_url = f"/uploads/{name}_small{ext}"
                else: # Fallback if no extension, though unlikely for images
                    primary_photo_small_url = f"/uploads/{base_filename}" # Or handle as an error/placeholder
            
        return {
            'id': self.id,
            'page_number': self.page_number,
            'position': self.position,
            'type': self.type,
            'label': self.label,
            'item_id': self.item_id,
            'item_parent_id': self.item_parent_id,
            'target_page_number': self.target_page_number,
            'color': self.color,
            'item_sku': item_instance.sku if item_instance else None, 
            'item_price': float(item_instance.price) if item_instance and item_instance.price is not None else None,
            'primary_photo_small_url': primary_photo_small_url
        }

    def __repr__(self):
        return f'<QuickAddItem {self.id} P:{self.page_number} Pos:{self.position} L:{self.label}>' 