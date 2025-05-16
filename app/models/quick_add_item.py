from app import db
from sqlalchemy.dialects.mysql import INTEGER

class QuickAddItem(db.Model):
    __tablename__ = 'quick_add_items'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    page_number = db.Column(db.Integer, nullable=False, default=1)
    position = db.Column(db.Integer, nullable=False) # 0-indexed position on the grid for a given page
    
    type = db.Column(db.String(50), nullable=False)  # 'item' or 'page_link'
    label = db.Column(db.String(100), nullable=False)
    
    item_id = db.Column(db.Integer, db.ForeignKey('Items.id'), nullable=True)
    item = db.relationship('Item', backref=db.backref('quick_add_references', lazy=True))
    
    target_page_number = db.Column(INTEGER(unsigned=True), nullable=True) # Target page if type is 'page_link'
    
    color = db.Column(db.String(7), nullable=True)  # Hex color code, e.g., #RRGGBB

    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def to_dict(self):
        primary_photo_small_url = None
        if self.type == 'item' and self.item and self.item.photos:
            primary_photo = next((p for p in self.item.photos if p.is_primary), None)
            if primary_photo:
                # Assuming Photo model has a to_dict or direct access to URL components
                # and that image URLs are correctly constructed (e.g., /uploads/...)
                # Let's assume photo objects have small_url like in ItemService item_to_dict
                base_url = "/uploads/" # This should ideally come from config or be more robust
                
                # Attempt to get small_url if Photo model has it directly or via a method
                # This part is speculative based on previous item_to_dict structure
                if hasattr(primary_photo, 'image_url'): # image_url might be the base filename
                     # Construct a plausible small_url, this needs to match ImageService logic
                     # For simplicity, if image_url is base, small is base + _small.ext
                     # This is a common pattern but might need adjustment to your actual Photo model / ImageService
                    parts = primary_photo.image_url.rsplit('.', 1)
                    if len(parts) == 2:
                        small_filename = f"{parts[0]}_small.{parts[1]}"
                        primary_photo_small_url = f"{base_url}{small_filename}"
                    else: # Fallback if no extension, less likely
                        primary_photo_small_url = f"{base_url}{primary_photo.image_url}" # Or just the raw if it's full path
            elif self.item.photos: # No primary, take first one if any for display
                first_photo = self.item.photos[0]
                if hasattr(first_photo, 'image_url'):
                    parts = first_photo.image_url.rsplit('.', 1)
                    if len(parts) == 2:
                        small_filename = f"{parts[0]}_small.{parts[1]}"
                        primary_photo_small_url = f"{base_url}{small_filename}"
                    else:
                        primary_photo_small_url = f"{base_url}{first_photo.image_url}"

        return {
            'id': self.id,
            'page_number': self.page_number,
            'position': self.position,
            'type': self.type,
            'label': self.label,
            'item_id': self.item_id,
            'target_page_number': self.target_page_number,
            'color': self.color,
            'item_sku': self.item.sku if self.item else None, 
            'item_price': self.item.price if self.item else None,
            'primary_photo_small_url': primary_photo_small_url
        }

    def __repr__(self):
        return f'<QuickAddItem {self.id} P:{self.page_number} Pos:{self.position} L:{self.label}>' 