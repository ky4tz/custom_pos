frappe.provide('erpnext.PointOfSale');

console.log("🚀 Custom POS Override Script Loaded!"); 

$(document).on('page-change', function() {
    if (frappe.get_route()[0] === 'point-of-sale') {
        setup_custom_pos_logic();
    }
});

if (frappe.get_route() && frappe.get_route()[0] === 'point-of-sale') {
    setTimeout(setup_custom_pos_logic, 1000);
}

function setup_custom_pos_logic() {
    if (window.pos_custom_observer_active) return;
    window.pos_custom_observer_active = true;

    // 1. Inject the UI fields when Payment screen is open
    const observer = new MutationObserver((mutations) => {
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
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 2. NEW TOGGLE LOGIC: Listen for direct clicks on the payment methods!
    $(document).on('click', '.mode-of-payment', function() {
        const custom_fields_div = document.getElementById('custom-pos-fields');
        if (custom_fields_div) {
            // Check the hidden 'data-payment-type' (Bank vs Cash)
            const payment_type = $(this).attr('data-payment-type');
            
            // If it is NOT cash, drop down the fields!
            if (payment_type && payment_type !== 'Cash') {
                custom_fields_div.style.display = 'block';
            } else {
                custom_fields_div.style.display = 'none';
            }
        }
    });

    // 3. Intercept "Complete Order" to save and enforce rules
    setTimeout(() => {
        if (erpnext.PointOfSale && erpnext.PointOfSale.Controller) {
            const original_save = erpnext.PointOfSale.Controller.prototype.save_and_submit;
            
            erpnext.PointOfSale.Controller.prototype.save_and_submit = function() {
                const custom_name = $('#pos_custom_name').val();
                const custom_digits = $('#pos_custom_digits').val();
                const custom_ref = $('#pos_custom_ref').val();

                // If the custom fields box is visible, we know it's a non-cash order!
                const custom_fields_div = document.getElementById('custom-pos-fields');
                const is_non_cash = custom_fields_div && custom_fields_div.style.display === 'block';

                if (is_non_cash) {
                    if (!custom_name || !custom_digits || !custom_ref) {
                        frappe.msgprint({
                            title: __('Missing Information'),
                            indicator: 'red',
                            message: __('Please enter the Name, Last 4 Digits, and Reference No. before completing a non-cash order.')
                        });
                        return; // Blocks the checkout!
                    }
                }

                if (this.frm && this.frm.doc) {
                    this.frm.doc.custom_name_on_cardbank_account = custom_name;
                    this.frm.doc.custom_last_4_digits = custom_digits;
                    this.frm.doc.custom_reference_noapproval_code = custom_ref;
                }

                return original_save.call(this);
            };
        }
    }, 2000); 
}
