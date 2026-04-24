frappe.provide('erpnext.PointOfSale');

console.log("🚀 Custom POS Script v3 Loaded (Native Styling & Hard Validation)!"); 

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

    // 1. Inject the UI fields using NATIVE ERPNext styling
    const observer = new MutationObserver((mutations) => {
        // Target the entire left column
        const payment_left_column = document.querySelector('.payment-container-left'); 
        
        if (payment_left_column && !document.getElementById('custom-pos-fields')) {
            console.log("✅ Injecting Native-Styled Fields");
            
            // Styled perfectly to match Frappe's native inputs, placed at the bottom of the column
            const custom_html = `
                <div id="custom-pos-fields" style="display:none; padding: 15px 0; border-top: 1px solid var(--border-color); margin-top: auto;">
                    <div class="text-muted" style="margin-bottom: 12px; font-weight: 600; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;">
                        Non-Cash Details
                    </div>
                    
                    <div class="control-input-wrapper" style="margin-bottom: 10px;">
                        <label class="control-label" style="font-size: 12px;">Name on Card / Bank Account</label>
                        <div class="control-input"><input type="text" id="pos_custom_name" class="input-with-feedback form-control input-xs"></div>
                    </div>
                    
                    <div class="control-input-wrapper" style="margin-bottom: 10px;">
                        <label class="control-label" style="font-size: 12px;">Last 4 Digits</label>
                        <div class="control-input"><input type="text" id="pos_custom_digits" class="input-with-feedback form-control input-xs" maxlength="4"></div>
                    </div>
                    
                    <div class="control-input-wrapper">
                        <label class="control-label" style="font-size: 12px;">Reference No. / Approval Code</label>
                        <div class="control-input"><input type="text" id="pos_custom_ref" class="input-with-feedback form-control input-xs"></div>
                    </div>
                </div>
            `;
            // Appends to the bottom of the left section, under the scrollable modes
            payment_left_column.insertAdjacentHTML('beforeend', custom_html);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 2. SHOW/HIDE LOGIC: "If it's not Cash, show it."
    $(document).on('click', '.payment-mode-wrapper', function() {
        const custom_fields_div = document.getElementById('custom-pos-fields');
        if (custom_fields_div) {
            // Get the name of the payment mode clicked
            const modeDiv = $(this).find('.mode-of-payment');
            let modeName = modeDiv.attr('data-mode') || $(this).text().trim();
            
            // If the user clicked Cash, hide. For literally anything else (GCash, QRPh, Card), show it.
            if (modeName === 'Cash') {
                custom_fields_div.style.display = 'none';
            } else {
                custom_fields_div.style.display = 'block';
            }
        }
    });

    // 3. HARD VALIDATION: Read the actual Frappe Data Payload
    setTimeout(() => {
        if (erpnext.PointOfSale && erpnext.PointOfSale.Controller) {
            const original_save = erpnext.PointOfSale.Controller.prototype.save_and_submit;
            
            erpnext.PointOfSale.Controller.prototype.save_and_submit = function() {
                const custom_name = $('#pos_custom_name').val();
                const custom_digits = $('#pos_custom_digits').val();
                const custom_ref = $('#pos_custom_ref').val();

                // --- DATA-LEVEL VALIDATION ---
                // We check the exact payment data Frappe is about to send to the database
                let requires_custom_fields = false;
                
                if (this.frm && this.frm.doc && this.frm.doc.payments) {
                    this.frm.doc.payments.forEach(payment => {
                        // If any payment line is NOT cash, and has money applied to it:
                        if (payment.mode_of_payment !== 'Cash' && payment.amount > 0) {
                            requires_custom_fields = true;
                        }
                    });
                }

                // If a non-cash payment exists, enforce the hard stop
                if (requires_custom_fields) {
                    if (!custom_name || !custom_digits || !custom_ref) {
                        frappe.msgprint({
                            title: __('Missing Information'),
                            indicator: 'red',
                            message: __('Please enter the Name, Last 4 Digits, and Reference No. before completing a non-cash order.')
                        });
                        return; // BLOCKS THE CHECKOUT
                    }
                }
                // -----------------------------

                // Inject data into the database fields
                if (this.frm && this.frm.doc) {
                    this.frm.doc.custom_name_on_cardbank_account = custom_name;
                    this.frm.doc.custom_last_4_digits = custom_digits;
                    this.frm.doc.custom_reference_noapproval_code = custom_ref;
                }

                // Proceed with the standard checkout
                return original_save.call(this);
            };
        }
    }, 2000); 
}
