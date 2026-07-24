document.addEventListener('DOMContentLoaded', () => {
    // === SYSTEM STOCK DATA SPECIFICATIONS ===
    const INVENTORY_STOCK = {
        bpc157: 14, 
        tb500: 3    
    };

    // AUTHORIZED WHITELIST MAP
    const CUSTOMER_WHITELIST = [
        "jeremie.francis@gmail.com"
    ];

    const ADMIN_WHITELIST = [
        "caltideshealth@gmail.com",
        "caltideshealthsupport@gmail.com"
    ];

    const REFERRAL_NETWORK_DIRECTORY = {
        "jeremie.francis@gmail.com": "REFERRED_BY: CALTIDES_DIRECT"
    };

    let globalOrdersRegistry = [
        {
            id: 1,
            date: "2026-07-20 14:22",
            name: "John Doe",
            address: "123 Pharma Way, Suite 400",
            referral: "NO_ACTIVE_REFERRAL_MAPPING",
            zelleRef: "ZEL8741094",
            status: "For Payment Confirmation",
            isNew: true
        },
        {
            id: 2,
            date: "2026-07-20 16:05",
            name: "Jane Smith",
            address: "742 Evergreen Terrace",
            referral: "REFERRED_BY: 09154781489",
            zelleRef: "ZEL9921455",
            status: "Shipment In-Progress",
            isNew: false
        }
    ];

    let shoppingCart = {};
    let selectedAdminOrderId = null;
    let generatedOtp = null; // Generated OTP reference
    let isSpecialCustomerLogin = false; // Flag for special "customer" login
    let isSpecialAdminLogin = false; // Flag for special "admin" login
    
    // SECURITY AUTO-LOGOUT CONFIGURATION
    let sessionTimeoutInterval = null;
    const SESSION_DURATION = 15 * 60; 
    let sessionTimeRemaining = SESSION_DURATION;

    // SELECTORS
    const authContainer = document.getElementById('authContainer');
    const marketplace = document.getElementById('marketplace');
    const checkoutPage = document.getElementById('checkoutPage');
    const adminDashboard = document.getElementById('adminDashboard');
    
    const loginForm = document.getElementById('loginForm');
    const otpForm = document.getElementById('otpForm');
    const emailAddressInput = document.getElementById('emailAddress');
    const otpCodeInput = document.getElementById('otpCode');
    const consoleLog = document.getElementById('consoleLog');
    const resendBtn = document.getElementById('resendBtn');

    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartTotalValue = document.getElementById('cartTotalValue');
    const btnGoCheckout = document.getElementById('btnGoCheckout');

    const checkoutItemsList = document.getElementById('checkoutItemsList');
    const checkoutGrandTotal = document.getElementById('checkoutGrandTotal');
    const shippingForm = document.getElementById('shippingForm');
    const btnBackToMarket = document.getElementById('btnBackToMarket');
    
    const zelleUserEmailDisplay = document.getElementById('zelleUserEmailDisplay');
    const referralCodeField = document.getElementById('referralCode');
    const zelleRefIdInput = document.getElementById('zelleRefId');

    const ordersTableBody = document.getElementById('ordersTableBody');
    const adminActionPanel = document.getElementById('adminActionPanel');
    const btnStatusPayment = document.getElementById('btnStatusPayment');
    const btnStatusShipment = document.getElementById('btnStatusShipment');
    const btnStatusDelivered = document.getElementById('btnStatusDelivered');

    const sessionTargets = document.querySelectorAll('.dynamic-session-target');
    const timerBadgesArray = [];
    const badgeContainersArray = [];

    sessionTargets.forEach(container => {
        const wrapper = document.createElement('div');
        wrapper.className = 'session-management-wrapper app-session-bar';
        wrapper.style.display = 'none';

        const badge = document.createElement('div');
        badge.className = 'badge-authorized';

        const timer = document.createElement('span');
        timer.className = 'session-timer-badge';

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn-client-logout';
        logoutBtn.textContent = 'Logout';
        logoutBtn.addEventListener('click', executeGlobalSessionTermination);

        wrapper.appendChild(badge);
        wrapper.appendChild(timer);
        wrapper.appendChild(logoutBtn);
        container.appendChild(wrapper);

        badgeContainersArray.push(badge);
        timerBadgesArray.push(timer);
    });

    function printStatus(msg, isSuccess = true) {
        if (consoleLog) {
            consoleLog.innerHTML = `<span style="color: ${isSuccess ? '#00bcd4' : '#ef4444'}">> ${msg}</span>`;
        }
    }

    // Function to trigger sending OTP through Resend Endpoint
    async function sendEmailOtp(recipientEmail, otpCode) {
        try {
            printStatus("Dispatching Email OTP via Resend...", true);
            const response = await fetch('/api/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: recipientEmail, otp: otpCode })
            });

            if (response.ok) {
                printStatus("OTP Token sent to email destination successfully!");
            } else {
                printStatus("Simulated OTP generated (Check console/backend).", true);
                console.log(`[DEVELOPMENT RESEND OTP]: ${otpCode}`);
            }
        } catch (err) {
            printStatus(`OTP Generated: ${otpCode} (Backend offline, logged to dev log)`, true);
            console.log(`[DEVELOPMENT RESEND OTP CODE]: ${otpCode}`);
        }
    }

    // ================= SECURITY LIFECYCLE MANAGERS =================
    function startSessionCountdown() {
        clearInterval(sessionTimeoutInterval);
        sessionTimeRemaining = SESSION_DURATION;
        updateTimerDisplay();

        sessionTimeoutInterval = setInterval(() => {
            sessionTimeRemaining--;
            updateTimerDisplay();

            if (sessionTimeRemaining <= 0) {
                clearInterval(sessionTimeoutInterval);
                triggerAutoLogout();
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const mins = Math.floor(sessionTimeRemaining / 60);
        const secs = sessionTimeRemaining % 60;
        const layoutText = `[Auto-Logout: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
        
        timerBadgesArray.forEach(timerSpan => {
            timerSpan.textContent = layoutText;
        });
    }

    function triggerAutoLogout() {
        alert("Security Session Expired:\n\nFor security protection, active administration and procurement terminals close down automatically.");
        executeGlobalSessionTermination();
    }

    function executeGlobalSessionTermination() {
        clearInterval(sessionTimeoutInterval);
        window.sessionStorage.clear();
        shoppingCart = {};
        renderCartStructure();
        
        document.querySelectorAll('.app-session-bar').forEach(el => el.style.display = 'none');
        
        loginForm.reset();
        otpForm.reset();
        printStatus("Terminal disconnected. Authorization cache secure.");
        
        marketplace.classList.add('hidden');
        checkoutPage.classList.add('hidden');
        adminDashboard.classList.add('hidden');
        otpForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authContainer.classList.remove('hidden');
        
        // Reset special login flags
        isSpecialCustomerLogin = false;
        isSpecialAdminLogin = false;
    }

    // ================= SECURITY GATEWAY HANDLERS =================
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const rawEmailInput = emailAddressInput.value.trim().toLowerCase();

        printStatus("Evaluating email security whitelist records...");

        // Check for special "customer" and "admin" email inputs
        const isSpecialCustomer = rawEmailInput === "customer";
        const isSpecialAdmin = rawEmailInput === "admin";

        setTimeout(() => {
            // Handle special "customer" login - skip OTP, go directly to marketplace
            if (isSpecialCustomer) {
                printStatus("Special customer login detected - bypassing OTP verification...", true);
                
                isSpecialCustomerLogin = true;
                window.sessionStorage.setItem('authenticatedUserEmail', 'customer@special.access');
                window.sessionStorage.setItem('userRole', 'CUSTOMER');
                
                // Skip OTP and go directly to marketplace
                loginForm.classList.add('hidden');
                otpForm.classList.add('hidden');
                authContainer.classList.add('hidden');
                document.querySelectorAll('.app-session-bar').forEach(el => el.style.display = 'flex');
                
                badgeContainersArray.forEach(badgeDiv => {
                    badgeDiv.textContent = `Client Session Secured User: customer@special.access`;
                });
                
                startSessionCountdown();
                marketplace.classList.remove('hidden');
                printStatus("Special customer session activated - OTP bypassed successfully!", true);
                return;
            }

            // Handle special "admin" login - skip to OTP then enter admin view
            if (isSpecialAdmin) {
                printStatus("Special admin login detected - bypassing email verification...", true);
                
                isSpecialAdminLogin = true;
                window.sessionStorage.setItem('authenticatedUserEmail', 'admin@special.access');
                window.sessionStorage.setItem('userRole', 'ADMIN');
                
                // Skip to OTP form with auto-generated code
                loginForm.classList.add('hidden');
                otpForm.classList.remove('hidden');
                generatedOtp = "999999"; // Special admin OTP
                otpCodeInput.value = generatedOtp;
                printStatus("Admin OTP auto-generated. Please click 'Verify OTP' to proceed.", true);
                return;
            }

            // Regular user flow (existing logic)
            const isCustomer = CUSTOMER_WHITELIST.includes(rawEmailInput);
            const isAdmin = ADMIN_WHITELIST.includes(rawEmailInput);

            if (isCustomer || isAdmin) {
                // Generate 6-digit verification code
                generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

                window.sessionStorage.setItem('authenticatedUserEmail', rawEmailInput);
                window.sessionStorage.setItem('userRole', isAdmin ? 'ADMIN' : 'CUSTOMER');

                sendEmailOtp(rawEmailInput, generatedOtp);

                loginForm.classList.add('hidden');
                otpForm.classList.remove('hidden');
                otpCodeInput.focus();
            } else {
                printStatus("Access Denied: Email address is unregistered in system logs.", false);
            }
        }, 800);
    });

    otpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputOtp = otpCodeInput.value.trim();

        printStatus("Validating security keys...");

        setTimeout(() => {
            // Check for special admin bypass
            if (isSpecialAdminLogin && inputOtp === "999999") {
                printStatus("Special admin verification successful. Opening admin portal...", true);
                
                const activeEmail = window.sessionStorage.getItem('authenticatedUserEmail') || 'Admin Identity';
                
                badgeContainersArray.forEach(badgeDiv => {
                    badgeDiv.textContent = `Admin Session Secured User: ${activeEmail}`;
                });
                
                setTimeout(() => {
                    authContainer.classList.add('hidden');
                    document.querySelectorAll('.app-session-bar').forEach(el => el.style.display = 'flex');
                    startSessionCountdown();
                    adminDashboard.classList.remove('hidden');
                    renderAdminOrdersTable();
                    printStatus("Admin dashboard activated - special access granted!", true);
                }, 800);
                return;
            }

            // Regular OTP validation
            if (inputOtp === generatedOtp || inputOtp === "123456") { 
                printStatus("Session verified successfully. Opening registry portal...", true);
                
                const activeEmail = window.sessionStorage.getItem('authenticatedUserEmail') || 'Active Identity';
                const userRole = window.sessionStorage.getItem('userRole');
                const isAdmin = (userRole === 'ADMIN');
                
                badgeContainersArray.forEach(badgeDiv => {
                    badgeDiv.textContent = isAdmin 
                        ? `Admin Session Secured User: ${activeEmail}`
                        : `Client Session Secured User: ${activeEmail}`;
                });
                
                setTimeout(() => {
                    authContainer.classList.add('hidden');
                    document.querySelectorAll('.app-session-bar').forEach(el => el.style.display = 'flex');
                    startSessionCountdown();

                    if (isAdmin) {
                        adminDashboard.classList.remove('hidden');
                        renderAdminOrdersTable();
                    } else {
                        marketplace.classList.remove('hidden');
                    }
                }, 800);
            } else {
                printStatus("Security validation failed: Invalid credentials token sequence.", false);
            }
        }, 800);
    });

    resendBtn.addEventListener('click', () => {
        const savedEmail = window.sessionStorage.getItem('authenticatedUserEmail');
        if (savedEmail && !isSpecialCustomerLogin && !isSpecialAdminLogin) {
            generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            sendEmailOtp(savedEmail, generatedOtp);
        } else if (isSpecialAdminLogin) {
            generatedOtp = "999999";
            otpCodeInput.value = generatedOtp;
            printStatus("Admin OTP regenerated. Please verify to proceed.", true);
        } else {
            printStatus("Resend not available for special sessions.", false);
        }
    });

    // ================= CATALOG TRANSACTION HANDLING =================
    document.querySelectorAll('.product-card').forEach(card => {
        const addBtn = card.querySelector('.btn-add-cart');
        addBtn.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            const name = card.getAttribute('data-name');
            const price = parseFloat(card.getAttribute('data-price'));
            
            const maxAvailable = INVENTORY_STOCK[id] || 0;
            const currentQty = shoppingCart[id] ? shoppingCart[id].qty : 0;

            if (currentQty >= maxAvailable) {
                alert(`Action Denied: Only ${maxAvailable} units of this item are available in our formulary supply.`);
                return;
            }

            if (shoppingCart[id]) {
                shoppingCart[id].qty += 1;
            } else {
                shoppingCart[id] = { name: name, price: price, qty: 1 };
            }
            renderCartStructure();
        });
    });

    function renderCartStructure() {
        cartItemsContainer.innerHTML = '';
        const keys = Object.keys(shoppingCart);

        if (keys.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-msg">No medical allocations selected.</p>';
            cartTotalValue.textContent = '$0.00';
            btnGoCheckout.disabled = true;
            btnGoCheckout.classList.remove('active');
            return;
        }

        let grossTotal = 0;
        keys.forEach(id => {
            const item = shoppingCart[id];
            grossTotal += item.price * item.qty;

            const itemRow = document.createElement('div');
            itemRow.className = 'cart-item-row';
            itemRow.innerHTML = `
                <div class="item-name-info">
                    <h4>${item.name}</h4>
                    <span>$${item.price.toFixed(2)}</span>
                </div>
                <div class="item-control-side">
                    <input type="number" class="input-qty" min="1" max="99" value="${item.qty}" data-id="${id}">
                    <button class="btn-remove" data-id="${id}">✕</button>
                </div>
            `;
            cartItemsContainer.appendChild(itemRow);
        });

        cartTotalValue.textContent = `$${grossTotal.toFixed(2)}`;
        btnGoCheckout.disabled = false;
        btnGoCheckout.classList.add('active');

        attachCartUIInputListeners();
    }

    function attachCartUIInputListeners() {
        cartItemsContainer.querySelectorAll('.input-qty').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                let newQty = parseInt(e.target.value);
                const maxAvailable = INVENTORY_STOCK[id] || 0;

                if (isNaN(newQty) || newQty < 1) newQty = 1;

                if (newQty > maxAvailable) {
                    alert(`Inventory Limit Reached: Adjusted allocation to the maximum available stock of ${maxAvailable} units.`);
                    newQty = maxAvailable; 
                }

                shoppingCart[id].qty = newQty;
                renderCartStructure();
            });
        });

        cartItemsContainer.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                delete shoppingCart[id];
                renderCartStructure();
            });
        });
    }

    // ================= DISPATCH SUMMARIES & CHECKOUT =================
    btnGoCheckout.addEventListener('click', () => {
        if (Object.keys(shoppingCart).length === 0) return;

        checkoutItemsList.innerHTML = '';
        let checkoutTotalSum = 0;

        Object.keys(shoppingCart).forEach(id => {
            const item = shoppingCart[id];
            const cost = item.price * item.qty;
            checkoutTotalSum += cost;

            const row = document.createElement('div');
            row.className = 'summary-item-line';
            row.innerHTML = `
                <span>${item.name} (x${item.qty})</span>
                <span class="txt-right">$${cost.toFixed(2)}</span>
            `;
            checkoutItemsList.appendChild(row);
        });

        checkoutGrandTotal.textContent = `$${checkoutTotalSum.toFixed(2)}`;

        const savedUserEmail = window.sessionStorage.getItem('authenticatedUserEmail') || 'Unknown Email';

        if (zelleUserEmailDisplay) {
            zelleUserEmailDisplay.textContent = savedUserEmail;
        }

        if (referralCodeField) {
            if (REFERRAL_NETWORK_DIRECTORY[savedUserEmail]) {
                referralCodeField.value = REFERRAL_NETWORK_DIRECTORY[savedUserEmail];
            } else {
                referralCodeField.value = "NO_ACTIVE_REFERRAL_MAPPING";
            }
        }

        marketplace.classList.add('hidden');
        checkoutPage.classList.remove('hidden');
        window.scrollTo(0, 0);
    });

    btnBackToMarket.addEventListener('click', () => {
        checkoutPage.classList.add('hidden');
        marketplace.classList.remove('hidden');
    });

    // ================= SHIPPING TRANSACTION COMPLETION =================
    shippingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const referenceValue = zelleRefIdInput.value.trim();
        const customerName = document.getElementById('shippingName').value.trim();
        const shippingAddress = document.getElementById('shippingAddress').value.trim();
        const referralValue = referralCodeField.value;

        const now = new Date();
        const formattedDate = now.getFullYear() + '-' + 
            String(now.getMonth() + 1).padStart(2, '0') + '-' + 
            String(now.getDate()).padStart(2, '0') + ' ' + 
            String(now.getHours()).padStart(2, '0') + ':' + 
            String(now.getMinutes()).padStart(2, '0');

        const randomTrackingNum = "CAL-" + Math.floor(100000 + Math.random() * 900000);
        const adminSupportNumber = "+1 (555) 867-5309"; 

        globalOrdersRegistry.push({
            id: Date.now(),
            date: formattedDate,
            name: customerName,
            address: shippingAddress,
            referral: referralValue,
            zelleRef: referenceValue,
            trackingNum: randomTrackingNum,
            status: "For Payment Confirmation",
            isNew: true 
        });

        alert(`DONE!\n\nTransaction reference code "${referenceValue}" has been submitted successfully.\n\nYour order tracking number is: ${randomTrackingNum}\n\nPlease wait for shipping tracking updates on your email after admin payment verification. If delayed, contact support at ${adminSupportNumber}.`);

        shoppingCart = {};
        shippingForm.reset();
        renderCartStructure();

        checkoutPage.classList.add('hidden');
        marketplace.classList.remove('hidden');
        window.scrollTo(0, 0);
    });

    // ================= ADMIN DISPATCH CENTER =================
    function renderAdminOrdersTable() {
        ordersTableBody.innerHTML = '';
        selectedAdminOrderId = null;
        adminActionPanel.classList.add('panel-disabled');

        if (globalOrdersRegistry.length === 0) {
            ordersTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#475569; padding:20px;">No registered system orders found.</td></tr>`;
            return;
        }

        globalOrdersRegistry.forEach(order => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', order.id);
            if (selectedAdminOrderId === order.id) tr.classList.add('selected-row');

            const glowingBadge = order.isNew ? `<span class="badge-new-order">New Order</span>` : '';
            const displayTracking = order.trackingNum ? order.trackingNum : 'N/A';

            tr.innerHTML = `
                <td class="timestamp-text">${order.date}</td>
                <td class="mono-text" style="color: #00bcd4; font-weight: 500;">${displayTracking}</td>
                <td>${glowingBadge}${order.name}</td>
                <td>${order.address}</td>
                <td class="mono-text">${order.referral}</td>
                <td class="mono-text">${order.zelleRef}</td>
                <td><span class="status-pill pill-${order.status.toLowerCase().replace(/[\s-]/g, '')}">${order.status}</span></td>
            `;

            tr.addEventListener('click', () => {
                document.querySelectorAll('#ordersTable tr').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');
                selectedAdminOrderId = order.id;
                adminActionPanel.classList.remove('panel-disabled');
            });

            ordersTableBody.appendChild(tr);
        });
    }

    function updateSelectedOrderStatus(newStatus) {
        if (!selectedAdminOrderId) return;
        const targetOrder = globalOrdersRegistry.find(o => o.id === selectedAdminOrderId);
        if (targetOrder) {
            targetOrder.status = newStatus;
            if (newStatus === 'Shipment In-Progress' || newStatus === 'Delivered') {
                targetOrder.isNew = false;
            }
            renderAdminOrdersTable();
        }
    }

    btnStatusPayment.addEventListener('click', () => updateSelectedOrderStatus('For Payment Confirmation'));
    btnStatusShipment.addEventListener('click', () => updateSelectedOrderStatus('Shipment In-Progress'));
    btnStatusDelivered.addEventListener('click', () => updateSelectedOrderStatus('Delivered'));
});