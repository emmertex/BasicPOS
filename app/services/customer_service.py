from app import db
from app.models.customer import Customer
from sqlalchemy.exc import IntegrityError

class CustomerService:
    @staticmethod
    def create_customer(data):
        try:
            # Ensure required fields are present
            if not data.get('phone') or not data.get('name'):
                return None, "Missing required fields: phone and name."

            new_customer = Customer(
                phone=data['phone'],
                name=data['name'],
                email=data.get('email'),
                address=data.get('address'),
                company_name=data.get('company_name')
            )
            db.session.add(new_customer)
            db.session.commit()
            return new_customer, None
        except IntegrityError as e:  # Catch issues like duplicate phone or email
            db.session.rollback()
            return None, f"Database integrity error: {str(e.orig)}"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def get_customer_by_id(customer_id):
        return Customer.query.get(customer_id)

    @staticmethod
    def get_customer_by_phone(phone):
        return Customer.query.filter_by(phone=phone).first()

    @staticmethod
    def get_all_customers():
        return Customer.query.all()

    @staticmethod
    def update_customer(customer_id, data):
        customer = Customer.query.get(customer_id)
        if not customer:
            return None, "Customer not found."

        try:
            if 'phone' in data:
                customer.phone = data['phone']
            if 'name' in data:
                customer.name = data['name']
            if 'email' in data: # Allows setting email to null if desired
                customer.email = data.get('email')
            if 'address' in data:
                customer.address = data.get('address')
            if 'company_name' in data:
                customer.company_name = data.get('company_name')
            
            db.session.commit()
            return customer, None
        except IntegrityError as e:
            db.session.rollback()
            return None, f"Database integrity error: {str(e.orig)}"
        except Exception as e:
            db.session.rollback()
            return None, str(e)

    @staticmethod
    def delete_customer(customer_id):
        customer = Customer.query.get(customer_id)
        if not customer:
            return False, "Customer not found."
        
        # Consider implications: what happens to sales linked to this customer?
        # The current DB schema for Sales.customer_id is ON DELETE SET NULL.
        # So, deleting a customer will set their ID in the Sales table to NULL.
        try:
            db.session.delete(customer)
            db.session.commit()
            return True, None
        except Exception as e:
            db.session.rollback()
            return False, str(e) 