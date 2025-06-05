from app import db

class SaleItem(db.Model):
    __tablename__ = 'SaleItems'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('Sales.id'), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey('Items.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    
    # price_at_sale: Stores the item's original unit price when added to the sale (before line-item discount)
    # This is crucial and should not be nullable if it represents the base price for discount calculations.
    price_at_sale = db.Column(db.Numeric(10, 2), nullable=False)
    
    # discount_type & discount_value: For line-item specific discounts
    discount_type = db.Column(db.String(50), nullable=True)  # e.g., 'Percentage', 'Absolute'
    discount_value = db.Column(db.Numeric(10, 2), nullable=True)
    
    # sale_price: Effective unit price for this item in this sale (price_at_sale after discount_value is applied)
    # This will be calculated and stored based on price_at_sale and discount.
    sale_price = db.Column(db.Numeric(10, 2), nullable=False)
    
    notes = db.Column(db.Text, nullable=True)

    # The relationship to Item is already defined in the Item model as 'sale_items'
    # The relationship to Sale is already defined in the Sale model as 'sale_items'

    def __repr__(self):
        return f'<SaleItem {self.id} for Sale {self.sale_id} - Item {self.item_id}>'

    # Helper property to calculate line total (optional, can also be done in service/route)
    # This is a Python property and won't be a database column.
    # The actual line total used for Sale.sale_total calculations should ideally be stored 
    # or consistently calculated by the service layer when Sale totals are aggregated.
    @property
    def line_total(self):
        if self.quantity is not None and self.sale_price is not None:
            return self.quantity * self.sale_price
        return 0 # Or raise an error, or return None 