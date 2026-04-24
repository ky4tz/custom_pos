frappe.provide('erpnext.PointOfSale');

console.log("🚀 Custom POS Script v6 (Compact UI & Safe Unfreeze)"); 

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

    // 1. COMPACT UI INJECTION: Placed INSIDE the payment list, right below the buttons.
    const observer = new MutationObserver(() => {
        const payment_modes_list = document.querySelector('.payment-modes'); 
        
        if (payment_modes_list && !document.getElementById('custom-pos-fields')) {
            const custom_html = `
                <div id="custom-pos-fields" style="display:none; padding: 12px; margin-top: 5px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--control-bg);">
                    <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                        Non-Cash Details
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="grid-column: span 2;">
                            <input type="text" id="pos_custom_name" class="form-control input-xs" placeholder="Name on Card / Bank Account" style="font-size: 12px; height: 28px;">
                        </div>
                        <div>
                            <input type="text" id="pos_custom_digits" class="form-control input-xs" maxlength="4" placeholder="Last 4 Digits" style="font-size: 12px; height: 28px;">
                        </div>
                        <div>
                            <input type="text" id="pos_custom_ref" class="form-control input-xs" placeholder="Ref No. / Approval" style="font-size: 12px; height: 28px;">
                        </div>
                    </div>
                </div>
            `;
            // 'beforeend' puts it inside the list box, right under the last payment method
            payment_modes_list.insertAdjacentHTML('beforeend', custom_html);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 2. TOGGLE VISIBILITY
    $(document).on('click', '.payment-mode-wrapper', function() {
        const custom_fields_div = document.getElementById('custom-pos-fields');
        if (custom_fields_div) {
            const modeName = $(this).find('.mode-of-payment').attr('data-mode') || $(this).text().trim();
            if (modeName === 'Cash') {
                custom_fields_div.style.display = 'none';
            } else {
                custom_fields_div.style.display = 'block';
            }
        }
    });

    // 3. NETWORK VALIDATION & UNFREEZE FIX
    if (!window.pos_frappe_call_patched) {
        window.pos_frappe_call_patched = true;
        const original_frappe_call = frappe.call;
        
        frappe.call = function(options) {
            if (options.method === "erpnext.selling.page.point_of_sale.point_of_sale.create_invoice") {
                
                let requires_custom_fields = false;
                let doc_obj = null;

                try {
                    if (options.args && options.args.doc) {
                        doc_obj = JSON.parse(options.args.doc);
                        if (doc_obj.payments) {
                            doc_obj.payments.forEach(p => {
                                if (p.mode_of_payment !== 'Cash' && p.amount > 0) {
                                    requires_custom_fields = true;
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error("Custom POS Parsing Error:", e);
                }
                
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

                        // CRITICAL FIX: Manually unfreeze the checkout button so the user isn't stuck!
                        setTimeout(() => {
                            const btn = document.querySelector('.submit-order-btn');
                            if (btn) {
                                btn.style.pointerEvents = 'auto';
                                btn.classList.remove('disabled');
                            }
                        }, 100);

                        return Promise.reject("Blocked by Custom POS Validation"); 
                    }
                    
                    // Inject data to database payload
                    if (doc_obj) {
                        doc_obj.custom_name_on_cardbank_account = custom_name;
                        doc_obj.custom_last_4_digits = custom_digits;
                        doc_obj.custom_reference_noapproval_code = custom_ref;
                        options.args.doc = JSON.stringify(doc_obj);
                    }
                }
            }
            return original_frappe_call.apply(this, arguments);
        };
    }
}
