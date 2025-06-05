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
const saleCustomerNotesTextarea = document.getElementById('sale-customer-notes');
const salePoNumberInput = document.getElementById('sale-po-number');

// --- Edit Sale Item Modal Elements ---
let editSaleItemModal;
let editSaleItemIdInput; // Hidden input for sale_item_id
let editSaleItemNameSpan;
let editSaleItemOriginalPriceSpan; // Displays original unit price
let editSaleItemQuantityInput;
let itemDiscountPercentInput;
let itemDiscountAbsoluteInput;
let itemFinalPriceSpan; // Displays calculated final UNIT price after discount
let editSaleItemNotesTextarea;
let saveEditSaleItemButton;
let closeEditSaleItemModalButton;
let currentEditingSaleItemOriginalPrice = 0; // to store the original price for calculations

// Call this function in app.js during DOMContentLoaded if not already initializing cart services
export function initCartService() {
    // Initialize existing cart event listeners if any are added here later
    // For now, primarily for the edit sale item modal
    editSaleItemModal = document.getElementById('edit-sale-item-modal');
    editSaleItemIdInput = document.getElementById('edit-sale-item-id');
    editSaleItemNameSpan = document.getElementById('edit-sale-item-name');
    editSaleItemOriginalPriceSpan = document.getElementById('edit-sale-item-original-price');
    editSaleItemQuantityInput = document.getElementById('edit-sale-item-quantity');
    itemDiscountPercentInput = document.getElementById('edit-sale-item-discount-percent');
    itemDiscountAbsoluteInput = document.getElementById('edit-sale-item-discount-absolute');
    itemFinalPriceSpan = document.getElementById('edit-sale-item-final-price');
    editSaleItemNotesTextarea = document.getElementById('edit-sale-item-notes');
    saveEditSaleItemButton = document.getElementById('save-edit-sale-item-button');
    closeEditSaleItemModalButton = document.getElementById('close-edit-sale-item-modal-button');

    if (saveEditSaleItemButton) {
        saveEditSaleItemButton.addEventListener('click', handleEditSaleItemSave);
    }
    if (closeEditSaleItemModalButton) {
        closeEditSaleItemModalButton.addEventListener('click', closeEditSaleItemModal);
    }
    if (itemDiscountPercentInput) {
        itemDiscountPercentInput.addEventListener('input', () => {
            if (itemDiscountPercentInput.value) itemDiscountAbsoluteInput.value = '';
            calculateAndDisplayFinalPrice();
        });
    }
    if (itemDiscountAbsoluteInput) {
        itemDiscountAbsoluteInput.addEventListener('input', () => {
            if (itemDiscountAbsoluteInput.value) itemDiscountPercentInput.value = '';
            calculateAndDisplayFinalPrice();
        });
    }
    if (editSaleItemQuantityInput) {
        editSaleItemQuantityInput.addEventListener('input', calculateAndDisplayFinalPrice);
    }
    
    if (saleCustomerNotesTextarea) {
        saleCustomerNotesTextarea.addEventListener('input', debouncedSaveSaleCustomerNotes);
    }
    if (salePoNumberInput) {
        salePoNumberInput.addEventListener('input', debouncedSaveSalePoNumber);
    }
}

function calculateAndDisplayFinalPrice() {
    if (!itemFinalPriceSpan || !editSaleItemQuantityInput) return;

    const quantity = parseFloat(editSaleItemQuantityInput.value) || 0;
    let unitPrice = currentEditingSaleItemOriginalPrice;

    const discountPercent = parseFloat(itemDiscountPercentInput.value);
    const discountAbsolute = parseFloat(itemDiscountAbsoluteInput.value);

    if (!isNaN(discountPercent) && discountPercent >= 0) {
        unitPrice = unitPrice * (1 - discountPercent / 100);
    } else if (!isNaN(discountAbsolute) && discountAbsolute >= 0) {
        unitPrice = Math.max(0, unitPrice - discountAbsolute); // Ensure price doesn't go below 0
    }
    
    itemFinalPriceSpan.textContent = unitPrice.toFixed(2); // Display final UNIT price
    // The total line price will be quantity * unitPrice, handled server-side or on save.
}

export function openEditSaleItemModal(saleItem) {
    if (!editSaleItemModal || !saleItem) {
        showToast("Could not open edit modal. Elements missing or no item data.", "error");
        console.error("Edit Sale Item Modal or saleItem data not available.", {editSaleItemModal, saleItem});
        return;
    }

    editSaleItemIdInput.value = saleItem.id; // This is sale_item.id
    editSaleItemNameSpan.textContent = saleItem.item.title; // Assuming saleItem has nested item object
    currentEditingSaleItemOriginalPrice = parseFloat(saleItem.price_at_sale);
    editSaleItemOriginalPriceSpan.textContent = currentEditingSaleItemOriginalPrice.toFixed(2);
    editSaleItemQuantityInput.value = saleItem.quantity;
    editSaleItemNotesTextarea.value = saleItem.notes || '';

    // Reset and populate discounts
    itemDiscountPercentInput.value = '';
    itemDiscountAbsoluteInput.value = '';
    if (saleItem.discount_type === 'Percentage' && saleItem.discount_value != null) {
        itemDiscountPercentInput.value = saleItem.discount_value;
    } else if (saleItem.discount_type === 'Absolute' && saleItem.discount_value != null) {
        itemDiscountAbsoluteInput.value = saleItem.discount_value;
    }
    
    calculateAndDisplayFinalPrice(); // Initial calculation
    editSaleItemModal.style.display = 'block';
}

export function closeEditSaleItemModal() {
    if (editSaleItemModal) {
        editSaleItemModal.style.display = 'none';
    }
}

async function handleEditSaleItemSave() {
    const saleItemId = editSaleItemIdInput.value;
    const quantity = parseInt(editSaleItemQuantityInput.value, 10);
    const notes = editSaleItemNotesTextarea.value.trim();
    const discountPercent = parseFloat(itemDiscountPercentInput.value);
    const discountAbsolute = parseFloat(itemDiscountAbsoluteInput.value);

    let discount_type = null;
    let discount_value = null;

    if (!isNaN(discountPercent) && discountPercent > 0) {
        discount_type = 'Percentage';
        discount_value = discountPercent;
    } else if (!isNaN(discountAbsolute) && discountAbsolute > 0) {
        discount_type = 'Absolute';
        discount_value = discountAbsolute;
    }
    // If both are zero or empty, they remain null (no discount or discount removed)

    if (isNaN(quantity) || quantity <= 0) {
        showToast("Quantity must be a positive number.", "error");
        return;
    }

    const payload = {
        quantity: quantity,
        notes: notes,
        discount_type: discount_type,
        discount_value: discount_value,
        // price_at_sale might be recalculated server-side based on original price and discount,
        // or you could send the calculated unitPrice here if the backend expects it.
        // For now, let backend handle price adjustment based on discount.
    };

    try {
        // Backend endpoint: PUT /api/sales/items/{sale_item_id}
        if (!state.currentSale || !state.currentSale.id) {
            showToast("Error: No active sale ID found to update item.", "error");
            return;
        }
        const updatedSaleItem = await apiCall(`/sales/${state.currentSale.id}/items/${saleItemId}`, 'PUT', payload);
        if (updatedSaleItem && updatedSaleItem.id) {
            showToast("Item updated in cart successfully.", "success");
            closeEditSaleItemModal();

            // Refresh sale state and UI
            const updatedSale = await apiCall(`/sales/${state.currentSale.id}`);
            if (updatedSale) {
                state.currentSale = updatedSale;
                updateCartDisplay();
            } else {
                showToast("Failed to refresh sale details after item update.", "warning");
            }
        } else {
            showToast(updatedSaleItem.error || "Failed to update item in cart. Please try again.", "error");
        }
    } catch (error) {
        console.error("Error updating sale item:", error);
        showToast("Error updating sale item: " + error.message, "error");
    }
}

// Debounce function
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

async function saveSaleCustomerNotes() {
    if (state.currentSale && state.currentSale.id && saleCustomerNotesTextarea) {
        const notes = saleCustomerNotesTextarea.value;
        if (state.currentSale.customer_notes !== notes) {
            const updatedSale = await apiCall(`/sales/${state.currentSale.id}`, 'PUT', { customer_notes: notes });
            if (updatedSale) {
                state.currentSale.customer_notes = updatedSale.customer_notes;
                // state.currentSale.purchase_order_number = updatedSale.purchase_order_number; // Ensure PO is also updated in state if returned
                showToast("Sale notes updated.", "success");
            } else {
                showToast("Failed to update sale notes.", "error");
                saleCustomerNotesTextarea.value = state.currentSale.customer_notes || '';
            }
        }
    }
}

const debouncedSaveSaleCustomerNotes = debounce(saveSaleCustomerNotes, 1000);

async function saveSalePoNumber() {
    if (state.currentSale && state.currentSale.id && salePoNumberInput) {
        const poNumber = salePoNumberInput.value;
        if (state.currentSale.purchase_order_number !== poNumber) {
            const updatedSale = await apiCall(`/sales/${state.currentSale.id}`, 'PUT', { purchase_order_number: poNumber });
            if (updatedSale) {
                state.currentSale.purchase_order_number = updatedSale.purchase_order_number;
                // state.currentSale.customer_notes = updatedSale.customer_notes; // Ensure notes are also updated in state if returned
                showToast("Sale PO Number updated.", "success");
            } else {
                showToast("Failed to update PO Number.", "error");
                salePoNumberInput.value = state.currentSale.purchase_order_number || '';
            }
        }
    }
}

const debouncedSaveSalePoNumber = debounce(saveSalePoNumber, 1000);

// Cart Management
export async function createNewSale(status = 'Open', customerId = null, customerNotes = null, poNumber = null) {
    const payload = { status: status };
    if (customerId) {
        payload.customer_id = customerId;
    }
    if (customerNotes !== null) {
        payload.customer_notes = customerNotes;
    }
    if (poNumber !== null) {
        payload.purchase_order_number = poNumber;
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
    // console.log("Attempting to add item to cart:", itemId); // Less verbose
    // let saleCreatedInThisCall = false; // Not strictly needed if createNewSale handles state correctly
    if (!state.currentSale || (state.currentSale.status !== 'Open' && state.currentSale.status !== 'Quote')) {
        console.log("No active 'Open' or 'Quote' sale, creating a new one.");
        const notesForNewSale = saleCustomerNotesTextarea ? saleCustomerNotesTextarea.value : null;
        const poForNewSale = salePoNumberInput ? salePoNumberInput.value : null;
        
        const newSale = await createNewSale('Open', state.currentCustomer ? state.currentCustomer.id : null, notesForNewSale, poForNewSale);
        if (!newSale) {
            showToast("Failed to create a new sale to add item.", "error");
            return;
        }
        // saleCreatedInThisCall = true; 
    }

    if (!state.currentSale || !state.currentSale.id) {
        showToast("Error: Sale ID is missing.", "error");
        console.error("state.currentSale or state.currentSale.id is missing before adding item:", state.currentSale);
        return;
    }

    const saleId = state.currentSale.id;
    let itemProcessed = false; // Flag to check if any item/component was processed

    // Fetch the base item details to check its parent_id
    const itemDetails = await apiCall(`/items/${itemId}`);
    if (!itemDetails) {
        showToast(`Failed to fetch details for item ID ${itemId}. Cannot add to cart.`, 'error');
        return;
    }

    if (itemDetails.parent_id === -3) { // Combination Item
        const combinationItemDetails = await apiCall(`/combination-items/${itemId}`);
        if (combinationItemDetails && combinationItemDetails.success && combinationItemDetails.components && combinationItemDetails.components.length > 0) {
            for (const component of combinationItemDetails.components) {
                const componentFullDetails = await apiCall(`/items/${component.item_id}`);
                if (componentFullDetails && componentFullDetails.price !== null && componentFullDetails.price !== undefined) {
                    const existingCartItem = state.currentSale.sale_items.find(si => si.item_id === component.item_id);
                    if (existingCartItem) {
                        // Item exists, update quantity
                        const newQuantity = existingCartItem.quantity + component.quantity;
                        await apiCall(`/sales/${saleId}/items/${existingCartItem.id}`, 'PUT', { quantity: newQuantity });
                    } else {
                        // Item does not exist, add new line item
                        const saleItemData = {
                            item_id: component.item_id,
                            quantity: component.quantity, 
                            price_at_sale: componentFullDetails.price 
                        };
                        await apiCall(`/sales/${saleId}/items`, 'POST', saleItemData);
                    }
                    itemProcessed = true;
                } else {
                    showToast(`Price missing for component ${component.title || ('ID: ' + component.item_id)}. Not added.`, 'warning');
                }
            }
            if (itemProcessed) showToast(`${itemDetails.title} (components) added/updated in cart.`, 'success');
            
        } else {
            showToast(`Could not retrieve valid components for ${itemDetails.title}. Item not added.`, 'error');
            console.error("Failed to get components for combo. Details:", combinationItemDetails);
            return; // Exit if combo components cannot be processed
        }
    } else { // Regular Item or Variant (parent_id != -3)
        if (price === null || price === undefined) {
            showToast(`Price missing for ${itemDetails.title}. Cannot add to cart.`, 'error');
            return;
        }
        const existingCartItem = state.currentSale.sale_items.find(si => si.item_id === itemId);
        if (existingCartItem) {
            // Item exists, update quantity (typically add 1 for a standard item click)
            const newQuantity = existingCartItem.quantity + 1;
            await apiCall(`/sales/${saleId}/items/${existingCartItem.id}`, 'PUT', { quantity: newQuantity });
        } else {
            // Item does not exist, add new line item
            const saleItemData = {
                item_id: itemId,
                quantity: 1, 
                price_at_sale: price 
            };
            await apiCall(`/sales/${saleId}/items`, 'POST', saleItemData);
        }
        itemProcessed = true;
        showToast(`${itemDetails.title} added/updated in cart.`, 'success');
    }

    if (itemProcessed) {
        // Refresh the entire sale state from the server after modifications
        const updatedSale = await apiCall(`/sales/${saleId}`);
        if (updatedSale) {
            state.currentSale = updatedSale;
            updateCartDisplay();
            collapseItemSearchResults(); // Assuming this is desired after adding any item
        } else {
            showToast("Cart updated, but failed to refresh sale details from server.", "warning");
            // Potentially try to update cart display with local state if server refresh fails
        }
    }
    // No explicit return here, function completes
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
                <button id="change-cart-customer-btn" class="btn btn-warning">Change/Remove Customer</button>
            `;
            document.getElementById('change-cart-customer-btn')?.addEventListener('click', () => {
                if (state.currentSale && state.currentSale.id) {
                    const saleId = state.currentSale.id;

                    state.currentCustomer = null;
                    state.currentSale.customer = null;
                    state.currentSale.customer_id = null;

                    apiCall(`/sales/${saleId}`, 'PUT', { customer_id: null })
                        .then(updatedSaleFromServer => {
                            if (updatedSaleFromServer) {
                                state.currentSale = updatedSaleFromServer;
                                if (updatedSaleFromServer.customer_id === null) {
                                    showToast("Customer removed from sale.", "info");
                                } else {
                                    showToast("Failed to remove customer on server. UI may be inconsistent.", "warning");
                                    console.warn('Backend failed to remove customer. Sale:', updatedSaleFromServer);
                                }
                            } else {
                                showToast("Error updating customer on server. Local view cleared.", "error");
                            }
                            updateCartDisplay(); 
                        })
                        .catch(error => {
                            showToast("Error contacting server to remove customer. Local view cleared.", "error");
                            console.error('Error in API call to remove customer:', error);
                            updateCartDisplay();
                        });
                } else {
                    // No current sale, just a selected customer for a potential new sale
                    state.currentCustomer = null;
                    // Directly update the customer display part of the cart
                    updateCartCustomerDisplay(null); // Pass null directly
                    showToast("Selected customer cleared.", "info");
                }
            });
        } else {
            customerDetailsCartDiv.innerHTML = '<p style="font-style: italic; color: #555;">No customer. Use Customer Management (left panel).</p>';
        }
    }
}

export function updateCartDisplay() {
    if (!cartItemsDiv || !cartTotalSpan || !cartSaleStatusSpan || !cartActionButtonsDiv || !customerDetailsCartDiv || !cartPaymentDetailsDiv || !cartAmountDueSpan || !saleCustomerNotesTextarea || !salePoNumberInput) {
        console.warn("updateCartDisplay: One or more cart UI elements not found. Cart display might be incomplete.");
        // Do not return, try to update what we can
    }

    // Remove existing blur listener to prevent multiple listeners
    if (saleCustomerNotesTextarea && saleCustomerNotesTextarea._blurListener) {
        saleCustomerNotesTextarea.removeEventListener('blur', saleCustomerNotesTextarea._blurListener);
        saleCustomerNotesTextarea.removeEventListener('input', saleCustomerNotesTextarea._inputListener);
        delete saleCustomerNotesTextarea._blurListener;
        delete saleCustomerNotesTextarea._inputListener;
    }
    if (salePoNumberInput && salePoNumberInput._blurListener) {
        salePoNumberInput.removeEventListener('blur', salePoNumberInput._blurListener);
        salePoNumberInput.removeEventListener('input', salePoNumberInput._inputListener);
        delete salePoNumberInput._blurListener;
        delete salePoNumberInput._inputListener;
    }

    if (cartItemsDiv) cartItemsDiv.innerHTML = ''; // Clear previous items
    if (cartPaymentDetailsDiv) cartPaymentDetailsDiv.innerHTML = ''; // Clear previous payment details

    if (state.currentSale && state.currentSale.id) {
        if (cartTotalSpan) cartTotalSpan.textContent = state.currentSale.sale_total !== null && state.currentSale.sale_total !== undefined ? state.currentSale.sale_total.toFixed(2) : '0.00';
        if (cartSaleStatusSpan) cartSaleStatusSpan.textContent = `${state.currentSale.status} (ID: ${state.currentSale.id})`;
        if (cartAmountDueSpan) cartAmountDueSpan.textContent = state.currentSale.amount_due !== null && state.currentSale.amount_due !== undefined ? state.currentSale.amount_due.toFixed(2) : '0.00';
        if (saleCustomerNotesTextarea) {
            saleCustomerNotesTextarea.value = state.currentSale.customer_notes || '';
            saleCustomerNotesTextarea.disabled = false;
            // Add new blur and input listeners
            saleCustomerNotesTextarea._blurListener = saveSaleCustomerNotes; // Persist immediately on blur
            saleCustomerNotesTextarea._inputListener = debouncedSaveSaleCustomerNotes; // Debounced save on input
            saleCustomerNotesTextarea.addEventListener('blur', saleCustomerNotesTextarea._blurListener);
            saleCustomerNotesTextarea.addEventListener('input', saleCustomerNotesTextarea._inputListener);
        }
        if (salePoNumberInput) {
            salePoNumberInput.value = state.currentSale.purchase_order_number || '';
            salePoNumberInput.disabled = false;
            salePoNumberInput._blurListener = saveSalePoNumber;
            salePoNumberInput._inputListener = debouncedSaveSalePoNumber;
            salePoNumberInput.addEventListener('blur', salePoNumberInput._blurListener);
            salePoNumberInput.addEventListener('input', salePoNumberInput._inputListener);
        }

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
        if (saleCustomerNotesTextarea) {
            saleCustomerNotesTextarea.value = ''; // Clear notes
            saleCustomerNotesTextarea.disabled = true; // Disable if no active sale
        }
        if (salePoNumberInput) {
            salePoNumberInput.value = '';
            salePoNumberInput.disabled = true;
        }
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
