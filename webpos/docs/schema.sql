-- Main Items Table
CREATE TABLE Items (
    id INTEGER NOT NULL AUTO_INCREMENT,
    parent_id INTEGER,
    is_current_version BOOLEAN NOT NULL DEFAULT TRUE,
    sku VARCHAR(255),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    is_stock_tracked BOOLEAN NOT NULL DEFAULT TRUE,
    title VARCHAR(2048) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    show_on_website BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    category_id INTEGER,
    PRIMARY KEY (id),
    FOREIGN KEY(category_id) REFERENCES Categories (id) ON DELETE SET NULL
);

-- Categories Table
CREATE TABLE Categories (
    id INTEGER NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER,
    PRIMARY KEY (id),
    UNIQUE (name),
    FOREIGN KEY(parent_id) REFERENCES Categories (id) ON DELETE SET NULL
);

-- Photos Table
CREATE TABLE Photos (
    id INTEGER NOT NULL AUTO_INCREMENT,
    item_id INTEGER NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    FOREIGN KEY(item_id) REFERENCES Items (id) ON DELETE CASCADE
);

-- Customers Table
CREATE TABLE Customers (
    id INTEGER NOT NULL AUTO_INCREMENT,
    phone VARCHAR(50),
    email VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    company_name VARCHAR(255),
    PRIMARY KEY (id)
);

CREATE TABLE Sales (
    id INTEGER NOT NULL AUTO_INCREMENT,
    customer_id INTEGER,
    status ENUM('Open', 'Quote', 'Invoice', 'Paid', 'Void') NOT NULL DEFAULT 'Open',
    overall_discount_type ENUM('none', 'percentage', 'fixed', 'target_total') DEFAULT 'none',
    overall_discount_value DECIMAL(10, 2) DEFAULT 0.00,
    overall_discount_amount_applied DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    customer_notes TEXT,
    internal_notes TEXT,
    purchase_order_number VARCHAR(100),
    PRIMARY KEY (id),
    FOREIGN KEY(customer_id) REFERENCES Customers (id)
);

-- SaleItems Table (Line items for a sale)
CREATE TABLE SaleItems (
    id INTEGER NOT NULL AUTO_INCREMENT,
    sale_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    price_at_sale DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sale_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    FOREIGN KEY(sale_id) REFERENCES Sales (id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES Items (id)
);

-- Payments Table
CREATE TABLE Payments (
    id INTEGER NOT NULL AUTO_INCREMENT,
    sale_id INTEGER NOT NULL,
    payment_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_details TEXT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(sale_id) REFERENCES Sales (id) ON DELETE CASCADE
);

-- Quick Add Items Table (as specified above)
CREATE TABLE quick_add_items (
    id INTEGER NOT NULL AUTO_INCREMENT,
    page_number INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    item_id INTEGER,
    item_parent_id INTEGER,
    target_page_number INTEGER UNSIGNED,
    color VARCHAR(7),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY(item_id) REFERENCES Items (id)
);

-- Combination Items Table
CREATE TABLE combination_items (
    id INTEGER NOT NULL AUTO_INCREMENT,
    item_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY(item_id) REFERENCES Items (id) ON DELETE CASCADE
);

-- Combination Item Components Table
CREATE TABLE combination_item_components (
    id INTEGER NOT NULL AUTO_INCREMENT,
    combination_item_id INTEGER NOT NULL,
    component_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY(combination_item_id) REFERENCES combination_items (id) ON DELETE CASCADE,
    FOREIGN KEY(component_item_id) REFERENCES Items (id) ON DELETE CASCADE
);