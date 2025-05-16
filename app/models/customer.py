from app import db

class Customer(db.Model):
    __tablename__ = 'Customers'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    phone = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=True)
    name = db.Column(db.String(255), nullable=False)
    address = db.Column(db.Text, nullable=True)
    company_name = db.Column(db.String(255), nullable=True)

    sales = db.relationship('Sale', backref='customer', lazy=True)

    def __repr__(self):
        return f'<Customer {self.id} {self.name}>' 