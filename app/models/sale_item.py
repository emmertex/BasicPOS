from app import db

class SaleItem(db.Model):
    __tablename__ = 'SaleItems'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('Sales.id'), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey('Items.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    sale_price = db.Column(db.Numeric(10, 2), nullable=False)
    price_at_sale = db.Column(db.Numeric(10, 2), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    # The relationship to Item is already defined in the Item model as 'sale_items'
    # The relationship to Sale is already defined in the Sale model as 'sale_items'

    def __repr__(self):
        return f'<SaleItem {self.id} for Sale {self.sale_id} - Item {self.item_id}>' 