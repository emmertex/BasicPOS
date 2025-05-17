import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state } from './uiState.js';
import { 
    collapseParkedSales, 
    expandParkedSales, 
    shrinkLeftPanel, 
    expandLeftPanel, 
    collapseItemSearchResults
} from './panelUtils.js';

// Placeholders: These will need to be imported from their actual locations (e.g., app.js or a new uiUtils.js)
// import { collapseItemSearchResults } from './app.js'; 
// import { collapseParkedSales, expandParkedSales, shrinkLeftPanel, expandLeftPanel } from './panelUtils.js'; // Or from app.js

const cartItemsDiv = document.getElementById('cart-items');
const cartTotalSpan = document.getElementById('cart-total');
const cartSaleStatusSpan = document.getElementById('cart-sale-status');
const cartActionButtonsDiv = document.getElementById('cart-action-buttons');
const customerDetailsCartDiv = document.getElementById('customer-details-cart');
const cartPaymentDetailsDiv = document.getElementById('cart-payment-details');
const cartAmountDueSpan = document.getElementById('cart-amount-due');

// Cart Management
export async function createNewSale(status = 'Open', customerId = null) {
    const payload = { status: status };
    if (customerId) {
        payload.customer_id = customerId;
    }
    const sale = await apiCall('/sales/', 'POST', payload);
    if (sale) {
        state.currentSale = sale; // Use state object
        console.log('New sale created/set:', state.currentSale);
        updateCartDisplay();
    }
    return sale;
}

export async function addItemToCart(itemId, price) {
    console.log("[cart.js] addItemToCart called with itemId:", itemId, "and price:", price);
    console.log("Attempting to add item to cart:", itemId);
    if (!state.currentSale || (state.currentSale.status !== 'Open' && state.currentSale.status !== 'Quote')) {
        console.log("No active 'Open' or 'Quote' sale, creating a new one.");
        const newSale = await createNewSale('Open', state.currentCustomer ? state.currentCustomer.id : null);
        if (!newSale) {
            showToast("Failed to create a new sale to add item.", "error");
            return;
        }
    }

    if (!state.currentSale || !state.currentSale.id) {
        showToast("Error: Sale ID is missing.", "error");
        console.error("state.currentSale or state.currentSale.id is missing before adding item:", state.currentSale);
        return;
    }
    
    const saleItemData = {
        item_id: itemId,
        quantity: 1,
        price_at_sale: price // 'price' here is the item.price passed into addItemToCart
    };

    const updatedSale = await apiCall(`/sales/${state.currentSale.id}/items`, 'POST', saleItemData);

    if (updatedSale) {
        state.currentSale = updatedSale;
        console.log('Item added, updated sale:', state.currentSale);
        updateCartDisplay();
        collapseItemSearchResults();
    } else {
        showToast("Failed to add item to cart.", "error");
    }
}
    
export async function loadSaleIntoCart(saleId) {
    const sale = await apiCall(`/sales/${saleId}`);
    if (sale) {
        state.currentSale = sale;
        if (sale.customer) {
            state.currentCustomer = sale.customer;
            if (customerDetailsCartDiv) customerDetailsCartDiv.textContent = `Customer: ${state.currentCustomer.name} (${state.currentCustomer.phone})`;
        } else if (sale.customer_id && state.currentCustomer && state.currentCustomer.id === sale.customer_id) {
            if (customerDetailsCartDiv) customerDetailsCartDiv.textContent = `Customer: ${state.currentCustomer.name} (${state.currentCustomer.phone})`;
        } else {
            state.currentCustomer = null;
            if (customerDetailsCartDiv) customerDetailsCartDiv.textContent = 'No customer selected';
        }
        updateCartDisplay();
        // if (itemSearchResultsDiv) itemSearchResultsDiv.innerHTML = ''; // itemSearchResultsDiv is not defined here
    }
}

export function updateCartCustomerDisplay(customer) {
    if (customerDetailsCartDiv) {
        if (customer && customer.id) {
            customerDetailsCartDiv.innerHTML = `
                <p><strong>Customer:</strong> ${customer.name}</p>
                <p>Phone: ${customer.phone || 'N/A'}</p>
                <button id="change-cart-customer-btn">Change/Remove Customer</button>
            `;
            document.getElementById('change-cart-customer-btn')?.addEventListener('click', () => {
                if (state.currentSale && state.currentSale.id) {
                    apiCall(`/sales/${state.currentSale.id}`, 'PUT', { customer_id: null }).then(updatedSale => {
                        if (updatedSale) {
                            state.currentSale = updatedSale;
                            state.currentCustomer = null;
                            updateCartDisplay();
                            showToast("Customer removed from sale.", "info");
                        } else {
                            showToast("Failed to remove customer from sale.", "error");
                        }
                    });
                } else {
                    state.currentCustomer = null;
                    updateCartDisplay();
                }
            });
        } else {
            customerDetailsCartDiv.innerHTML = '<p style="font-style: italic; color: #555;">No customer. Use Customer Management (left panel).</p>';
        }
    }
}

export function updateCartDisplay() {
    if (!cartItemsDiv || !cartTotalSpan || !cartSaleStatusSpan || !cartActionButtonsDiv || !customerDetailsCartDiv || !cartPaymentDetailsDiv || !cartAmountDueSpan) {
        console.warn("updateCartDisplay: One or more cart UI elements not found. Cart display might be incomplete.");
        // Do not return, try to update what we can
    }

    if (cartItemsDiv) cartItemsDiv.innerHTML = ''; // Clear previous items
    if (cartPaymentDetailsDiv) cartPaymentDetailsDiv.innerHTML = ''; // Clear previous payment details

    if (state.currentSale && state.currentSale.id) {
        if (cartTotalSpan) cartTotalSpan.textContent = state.currentSale.sale_total !== null && state.currentSale.sale_total !== undefined ? state.currentSale.sale_total.toFixed(2) : '0.00';
        if (cartSaleStatusSpan) cartSaleStatusSpan.textContent = `${state.currentSale.status} (ID: ${state.currentSale.id})`;
        if (cartAmountDueSpan) cartAmountDueSpan.textContent = state.currentSale.amount_due !== null && state.currentSale.amount_due !== undefined ? state.currentSale.amount_due.toFixed(2) : '0.00';

        // Display Payment Details
        if (cartPaymentDetailsDiv && state.currentSale.payments && state.currentSale.payments.length > 0) {
            state.currentSale.payments.forEach(payment => {
                if (payment && payment.amount > 0) { 
                    const paymentDiv = document.createElement('p');
                    paymentDiv.className = 'cart-payment-line';
                    const paymentDate = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A';
                    paymentDiv.innerHTML = `Paid by ${payment.payment_type} on ${paymentDate}: <span class="payment-amount">$${payment.amount.toFixed(2)}</span>`;
                    cartPaymentDetailsDiv.appendChild(paymentDiv);
                }
            });
        }

        if (state.currentSale.sale_items && state.currentSale.sale_items.length > 0) {
            state.currentSale.sale_items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('cart-item-entry-rich');

                const itemTitle = item.item ? item.item.title : 'Unknown Item';
                const itemId = item.item_id;
                const itemSku = item.item && item.item.sku ? item.item.sku : 'N/A';
                let imageUrl = 'https://via.placeholder.com/80x80.png?text=No+Img';
                if (item.item && item.item.photos && item.item.photos.length > 0 && item.item.photos[0].thumbnail_url) {
                    imageUrl = item.item.photos[0].thumbnail_url;
                } else if (item.item && item.item.photos && item.item.photos.length > 0 && item.item.photos[0].small_url) {
                    imageUrl = item.item.photos[0].small_url;
                }

                const itemDescription = item.item && item.item.description ? item.item.description : 'No description available.';
                const saleItemNotes = item.notes || '';
                
                const originalPrice = item.item && item.item.price !== undefined ? item.item.price.toFixed(2) : '0.00';
                const priceAtSaleString = item.price_at_sale !== undefined && item.price_at_sale !== null ? item.price_at_sale.toFixed(2) : '0.00';
                
                const priceBeforeDiscount = parseFloat(item.price_at_sale);
                const priceAfterDiscount = parseFloat(item.sale_price);
                const itemQuantity = parseInt(item.quantity) || 0;

                let lineItemDiscountValue = 0;
                if (!isNaN(priceBeforeDiscount) && !isNaN(priceAfterDiscount) && itemQuantity > 0) {
                    lineItemDiscountValue = (priceBeforeDiscount - priceAfterDiscount) * itemQuantity;
                }
                const lineItemDiscountDisplay = lineItemDiscountValue.toFixed(2);

                const salePriceForSubtotal = !isNaN(priceAfterDiscount) ? priceAfterDiscount : 0;
                const subtotalDisplay = (itemQuantity * salePriceForSubtotal).toFixed(2);

                itemDiv.innerHTML = `
                    <div class="cart-item-image-area">
                        <img src="${imageUrl}" alt="${itemTitle}">
                    </div>
                    <div class="cart-item-details-area">
                        <div class="cart-item-title-sku">
                            <span class="cart-item-title">${itemTitle}</span>
                            <span class="cart-item-sku">SKU: ${itemSku}</span>
                        </div>
                        <div class="cart-item-description">${itemDescription.substring(0,100)}${itemDescription.length > 100 ? '...' : ''}</div>
                        <div class="cart-item-notes-display">Notes: ${saleItemNotes || 'None'}</div>
                    </div>
                    <div class="cart-item-pricing-area">
                        <div class="cart-item-price">Price: \$${priceAtSaleString}</div>
                        <div class="cart-item-quantity">
                            Qty: <input type="number" class="cart-item-quantity-input" data-sale-item-id="${item.id}" value="${itemQuantity}" min="0">
                        </div>
                        <div class="cart-item-discount">Discount: \$${lineItemDiscountDisplay}</div>
                        <div class="cart-item-subtotal">Sub-Total: \$${subtotalDisplay}</div>
                    </div>
                    <div class="cart-item-actions-area">
                        <button class="edit-cart-item-btn rich-btn" 
                                data-sale-item-id="${item.id}" 
                                data-item-name="${itemTitle}" 
                                data-price-at-sale="${priceAtSaleString}"
                                data-current-notes="${saleItemNotes}"
                                title="Edit Item Details">
                            <span class="icon-pencil">&#9998;</span>
                        </button>
                        <button class="remove-from-cart-btn rich-btn" data-sale-item-id="${item.id}" title="Remove Item">
                            <span class="icon-bin">&#128465;</span>
                        </button>
                    </div>
                `;
                cartItemsDiv.appendChild(itemDiv);
            });
        } else {
            cartItemsDiv.innerHTML = '<p>Cart is empty.</p>';
        }

        if (state.currentSale.customer) {
            updateCartCustomerDisplay(state.currentSale.customer);
        } else {
            updateCartCustomerDisplay(null);
        }

        if (state.currentSale.sale_items.length > 0 || state.currentSale.customer_id) {
            collapseParkedSales();
        } else {
            expandParkedSales();
        }
        if (state.currentSale.customer_id) {
            shrinkLeftPanel();
        } else {
            expandLeftPanel();
        }

        // Show action buttons if there is an active sale
        if (cartActionButtonsDiv) {
            cartActionButtonsDiv.style.display = 'flex'; 
        }

    } else {
        if (cartTotalSpan) cartTotalSpan.textContent = '0.00';
        if (cartSaleStatusSpan) cartSaleStatusSpan.textContent = 'No Active Sale';
        if (cartAmountDueSpan) cartAmountDueSpan.textContent = '0.00'; // Reset amount due
        if (cartPaymentDetailsDiv) cartPaymentDetailsDiv.innerHTML = ''; // Clear payment details
        if (cartActionButtonsDiv) cartActionButtonsDiv.style.display = 'none';
        cartItemsDiv.innerHTML = '<p>No active sale. Add an item or load a parked sale.</p>';
        expandParkedSales(); 
        expandLeftPanel(); 
    }
}

export async function handleUpdateCartItemQuantity(saleItemId, newQuantity) {
    if (!state.currentSale || !state.currentSale.id) {
        showToast('No active sale to update quantity.', 'error');
        return;
    }
    if (isNaN(newQuantity) || newQuantity < 1) {
        showToast('Invalid quantity. Please enter a number greater than 0.', 'error');
        const itemInCart = state.currentSale.sale_items.find(si => si.id == saleItemId);
        if (itemInCart) {
            const inputField = cartItemsDiv.querySelector(`.cart-item-quantity-input[data-sale-item-id="${saleItemId}"]`);
            if (inputField) inputField.value = itemInCart.quantity;
        }
        return;
    }

    const payload = { quantity: newQuantity };

    try {
        const updatedSale = await apiCall(`/sales/${state.currentSale.id}/items/${saleItemId}`, 'PUT', payload);
        if (updatedSale && updatedSale.id) {
            state.currentSale = updatedSale;
            updateCartDisplay(); 
            showToast('Item quantity updated successfully!', 'success');
        } else {
            showToast('Failed to update quantity. Refreshing cart for consistency.', 'error');
            await loadSaleIntoCart(state.currentSale.id);
        }
    } catch (error) {
        console.error('Error updating sale item quantity:', error);
        showToast(`Error updating quantity: ${error.message || 'Unknown error'}`, 'error');
        await loadSaleIntoCart(state.currentSale.id);
    }
}

export async function handleRemoveItemFromCart(saleItemId) {
    if (!state.currentSale || !state.currentSale.id) {
        showToast('No active sale to remove item from.', 'error');
        return;
    }
    if (!saleItemId) {
        showToast('Error: Sale Item ID is missing.', 'error');
        return;
    }
    
    try {
        const updatedSale = await apiCall(`/sales/${state.currentSale.id}/items/${saleItemId}`, 'DELETE');

        if (updatedSale && updatedSale.id) {
            state.currentSale = updatedSale;
            showToast('Item removed from cart successfully.', 'success');
            updateCartDisplay();
        } else if (updatedSale === true) {
            showToast('Item removed. Refreshing cart...', 'info');
            await loadSaleIntoCart(state.currentSale.id);
        } else {
            showToast('Item removal status unclear, attempting to refresh cart.', 'warning');
            if (state.currentSale && state.currentSale.id) {
                 await loadSaleIntoCart(state.currentSale.id);
            } else {
                 state.currentSale = null; 
                 updateCartDisplay();
                 showToast('Failed to remove item or refresh cart. Cart may be inconsistent.', 'error');    
            }
        }
    } catch (error) {
        console.error('Error removing item from cart:', error);
        showToast(`Error removing item: ${error.message || 'Network error'}`, 'error');
        if (state.currentSale && state.currentSale.id) {
            await loadSaleIntoCart(state.currentSale.id);
        }
    }
}
