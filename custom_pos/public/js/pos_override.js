frappe.provide('erpnext.PointOfSale');

console.log("🚀 Custom POS Script v5 (Bulletproof Payload Validation)"); 

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

    // 1. Inject the UI perfectly below the payment modes list
    const observer = new MutationObserver((mutations) => {
        const payment_modes_list = document.querySelector('.payment-modes'); 
        
        if (payment_modes_list && !document.getElementById('custom-pos-fields')) {
            const custom_html = `
                <div id="custom-pos-fields" style="display:none; padding: 15px 0; margin-top: 15px; border-top: 1px solid var(--border-color);">
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
            payment_modes_list.insertAdjacentHTML('afterend', custom_html);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 2. Simple Click Toggle (Listen for clicks directly on the wrappers)
    $(document).on('click', '.payment-mode-wrapper', function() {
        const custom_fields_div = document.getElementById('custom-pos-fields');
        if (custom_fields_div) {
            // Get the exact name of the payment mode clicked
            const modeName = $(this).find('.mode-of-payment').attr('data-mode');
            
            // If the mode is strictly "Cash", hide the boxes. Everything else shows them.
            if (modeName === 'Cash') {
                custom_fields_div.style.display = 'none';
            } else {
                custom_fields_div.style.display = 'block';
            }
        }
    });

    // 3. The Payload Interceptor (100% Unbreakable Validation)
    if (!window.pos_frappe_call_patched) {
        window.pos_frappe_call_patched = true;
        const original_frappe_call = frappe.call;
        
        frappe.call = function(options) {
            if (options.method === "erpnext.selling.page.point_of_sale.point_of_sale.create_invoice") {
                
                let requires_custom_fields = false;
                let doc_obj = null;

                // Parse the exact data payload leaving the browser to the database
                try {
                    if (options.args && options.args.doc) {
                        doc_obj = JSON.parse(options.args.doc);
                        if (doc_obj.payments) {
                            // Loop through the payments applied to this order
                            doc_obj.payments.forEach(p => {
                                // If any payment is NOT Cash AND has money applied to it:
                                if (p.mode_of_payment !== 'Cash' && p.amount > 0) {
                                    requires_custom_fields = true;
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error("Custom POS Parsing Error:", e);
                }
                
                // If the payload contains a non-cash payment, Enforce the hard stop!
                if (requires_custom_fields) {
                    const custom_name = $('#pos_custom_name').val();
                    const custom_digits = $('#pos_custom_digits').val();
                    const custom_ref = $('#pos_custom_ref').val();
                    
                    if (!custom_name || !custom_digits || !custom_ref) {
                        frappe.msgprint({
                            title: __('Missing Information'),
                            indicator: 'red',
                            message: __('Please enter the Name, Last 4 Digits, and Reference No. before completing a non-cash order.')
                        });
                        return Promise.reject("Blocked by Custom POS Validation"); // Freezes checkout immediately
                    }
                    
                    // Inject the data directly into the database payload
                    if (doc_obj) {
                        doc_obj.custom_name_on_cardbank_account = custom_name;
                        doc_obj.custom_last_4_digits = custom_digits;
                        doc_obj.custom_reference_noapproval_code = custom_ref;
                        options.args.doc = JSON.stringify(doc_obj);
                    }
                }
            }
            // Let the network request proceed to the server
            return original_frappe_call.apply(this, arguments);
        };
    }
}
