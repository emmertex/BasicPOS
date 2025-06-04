from app import db
from sqlalchemy.orm import relationship
from .item import Item # Assuming Item model is in app/models/item.py

class CombinationItem(db.Model):
    __tablename__ = 'combination_items'
    id = db.Column(db.Integer, primary_key=True)
    # This item_id links to the base Item entry that represents this combo
    item_id = db.Column(db.Integer, db.ForeignKey('Items.id'), nullable=False, unique=True) 
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    # Relationship to the base Item entry
    item_record = relationship("Item", backref=db.backref("combination_details", uselist=False))
    
    # Relationship to its components
    components = relationship("CombinationItemComponent", back_populates="combination_item", cascade="all, delete-orphan")

    def __repr__(self):
        return f'<CombinationItem {self.id} (Item ID: {self.item_id})>'

class CombinationItemComponent(db.Model):
    __tablename__ = 'combination_item_components'
    id = db.Column(db.Integer, primary_key=True)
    combination_item_id = db.Column(db.Integer, db.ForeignKey('combination_items.id'), nullable=False)
    # This component_item_id links to the Item entry that IS a component of the combo
    component_item_id = db.Column(db.Integer, db.ForeignKey('Items.id'), nullable=False) 
    quantity = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    combination_item = relationship("CombinationItem", back_populates="components")
    # Relationship to the Item that is the component
    component_item_record = relationship("Item", foreign_keys=[component_item_id])

    def __repr__(self):
        return f'<CombinationItemComponent {self.id} (Combo ID: {self.combination_item_id}, Item ID: {self.component_item_id})>' 