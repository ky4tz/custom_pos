frappe.provide('erpnext.PointOfSale');

// This helps us know the file actually loaded!
console.log("🚀 Custom POS Override Script Loaded!"); 

// Trigger when navigating to the POS page
$(document).on('page-change', function() {
    if (frappe.get_route()[0] === 'point-of-sale') {
        setup_custom_pos_logic();
    }
});

// Trigger if the user refreshes directly on the POS page
if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
    setTimeout(setup_custom_pos_logic, 1000);
}

function setup_custom_pos_logic() {
    // Prevent the observer from running twice
    if (window.pos_custom_observer_active) return;
    window.pos_custom_observer_active = true;

    // 1. Inject the UI fields when Payment screen is open
    const observer = new MutationObserver((mutations) => {
        
        // Looks for multiple possible class names used by different ERPNext versions
        const payment_container = document.querySelector('.payment-modes') || document.querySelector('.payment-method-container'); 
        
        if (payment_container && !document.getElementById('custom-pos-fields')) {
            console.log("✅ Found the payment area! Injecting fields now.");
            
            const custom_html = `
                <div id="custom-pos-fields" style="display:none; padding: 15px; background: var(--control-bg, #2B2B2B); border-radius: 8px; margin-top: 15px;">
                    <label style="font-size: 12px; color: var(--text-muted);">Name on Card / Bank Account</label>
                    <input type="text" id="pos_custom_name" class="form-control" style="margin-bottom: 10px;">
                    
                    <label style="font-size: 12px; color: var(--text-muted);">Last 4 Digits</label>
                    <input type="text" id="pos_custom_digits" class="form-control" style="margin-bottom: 10px;" maxlength="4">
                    
                    <label style="font-size: 12px; color: var(--text-muted);">Reference No. / Approval Code</label>
                    <input type="text" id="pos_custom_ref" class="form-control">
                </div>
            `;
            payment_container.insertAdjacentHTML('afterend', custom_html);
        }

        // Logic to show/hide based on clicked payment method
        const active_method = document.querySelector('.mode-of-payment.is-selected');
        const custom_fields_div = document.getElementById('custom-pos-fields');
        
        if (active_method && custom_fields_div) {
            const method_name = active_method.innerText.trim();
            if (method_name !== 'Cash') {
                custom_fields_div.style.display = 'block';
            } else {
                custom_fields_div.style.display = 'none';
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 2. Intercept the "Complete Order" function to save the data & enforce mandatory rules
    setTimeout(() => {
        if (erpnext.PointOfSale && erpnext.PointOfSale.Controller) {
            const original_save = erpnext.PointOfSale.Controller.prototype.save_and_submit;
            
            erpnext.PointOfSale.Controller.prototype.save_and_submit = function() {
                // Grab the values from our custom HTML inputs
                const custom_name = $('#pos_custom_name').val();
                const custom_digits = $('#pos_custom_digits').val();
                const custom_ref = $('#pos_custom_ref').val();

                // --- MANDATORY VALIDATION ---
                const active_method = document.querySelector('.mode-of-payment.is-selected');
                if (active_method && active_method.innerText.trim() !== 'Cash') {
                    // If any of the 3 fields are empty, stop and show an error
                    if (!custom_name || !custom_digits || !custom_ref) {
                        frappe.msgprint({
                            title: __('Missing Information'),
                            indicator: 'red',
                            message: __('Please enter the Name, Last 4 Digits, and Reference No. before completing a non-cash order.')
                        });
                        return; // This blocks the checkout!
                    }
                }
                // ----------------------------

                // Inject them into your EXACT Frappe database fields
                if (this.frm && this.frm.doc) {
                    this.frm.doc.custom_name_on_cardbank_account = custom_name;
                    this.frm.doc.custom_last_4_digits = custom_digits;
                    this.frm.doc.custom_reference_noapproval_code = custom_ref;
                }

                // Proceed with the standard checkout
                return original_save.call(this);
            };
        }
    }, 2000); // Wait 2 seconds for POS classes to fully load
}
