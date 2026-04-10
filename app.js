// ECO-POS 收银系统主程序 - IndexedDB 版本

// ==================== IndexedDB 数据存储 ====================
const DB_NAME = 'ECO-POS-DB';
const DB_VERSION = 1;
let db = null;

// 初始化 IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            if (!database.objectStoreNames.contains('products')) {
                database.createObjectStore('products', { keyPath: 'barcode' });
            }
            if (!database.objectStoreNames.contains('orders')) {
                const orderStore = database.createObjectStore('orders', { keyPath: 'id' });
                orderStore.createIndex('time', 'time', { unique: false });
            }
            if (!database.objectStoreNames.contains('settings')) {
                database.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

// Storage API
const Storage = {
    async getAll(storeName) {
        if (!db) await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async getSettings() {
        if (!db) await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get('settings');
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    },
    
    async setSettings(value) {
        if (!db) await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key: 'settings', value: value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    async clearAndSetAll(storeName, items) {
        if (!db) await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                if (Array.isArray(items) && items.length > 0) {
                    items.forEach(item => store.put(item));
                }
                resolve();
            };
            clearRequest.onerror = () => reject(clearRequest.error);
        });
    },
    
    async addItem(storeName, item) {
        if (!db) await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    async deleteItem(storeName, key) {
        if (!db) await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    async clear(storeName) {
        if (!db) await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// ==================== 默认数据 ====================
const defaultProducts = [
    { barcode: '6901234567890', name: '可口可乐 500ml', category: 'food', price: 3.50, stock: 100, cost: 2.00 },
    { barcode: '6901234567891', name: '雪碧 500ml', category: 'food', price: 3.50, stock: 80, cost: 2.00 },
    { barcode: '6901234567892', name: '农夫山泉 550ml', category: 'food', price: 2.00, stock: 200, cost: 1.00 },
    { barcode: '6901234567893', name: '康师傅红烧牛肉面', category: 'food', price: 4.50, stock: 150, cost: 2.50 },
    { barcode: '6901234567894', name: '奥利奥饼干', category: 'food', price: 6.80, stock: 60, cost: 4.00 },
    { barcode: '6901234567895', name: '舒肤佳香皂', category: 'daily', price: 5.50, stock: 50, cost: 3.00 },
    { barcode: '6901234567896', name: '清风抽纸 3包', category: 'daily', price: 9.90, stock: 40, cost: 6.00 },
    { barcode: '6901234567897', name: '手机充电线', category: 'digital', price: 19.90, stock: 30, cost: 8.00 },
    { barcode: '6901234567898', name: '蓝牙耳机', category: 'digital', price: 89.00, stock: 20, cost: 45.00 },
    { barcode: '6901234567899', name: '纯棉T恤', category: 'clothing', price: 59.00, stock: 25, cost: 25.00 }
];

const defaultSettings = {
    shopName: 'ECO-SHOP',
    shopPhone: '',
    shopAddress: '',
    receiptTitle: '欢迎光临',
    receiptFooter: '谢谢惠顾，欢迎下次光临！',
    receiptCopies: 1
};

// 内存中的购物车
let cart = [];
let currentPaymentMethod = 'cash';
let editingProduct = null;

// ==================== 初始化 ====================
async function initApp() {
    await initDB();
    
    // 检查并初始化默认数据
    const products = await Storage.getAll('products');
    if (products.length === 0) {
        await Storage.clearAndSetAll('products', defaultProducts);
    }
    
    const orders = await Storage.getAll('orders');
    const settings = await Storage.getSettings();
    if (!settings) {
        await Storage.setSettings(defaultSettings);
    }
    
    initNavigation();
    initCashier();
}

// ==================== 页面导航 ====================
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageName = item.dataset.page;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(`${pageName}-page`).classList.add('active');
            
            if (pageName === 'products') loadProducts();
            if (pageName === 'orders') loadOrders();
            if (pageName === 'reports') loadReports();
            if (pageName === 'settings') loadSettings();
        });
    });
}

// ==================== 收银台功能 ====================
function initCashier() {
    renderCart();
    renderQuickProducts();
    
    const barcodeInput = document.getElementById('barcode-input');
    barcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchProduct();
        }
    });
    
    const paymentBtns = document.querySelectorAll('.payment-btn');
    paymentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            paymentBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPaymentMethod = btn.dataset.method;
        });
    });
    
    document.addEventListener('keydown', handleShortcuts);
}

function handleShortcuts(e) {
    if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('barcode-input').focus();
    }
    if (e.key === 'F3' && cart.length > 0) {
        e.preventDefault();
        const lastItem = cart[cart.length - 1];
        const newQty = prompt(`修改 "${lastItem.name}" 的数量:`, lastItem.quantity);
        if (newQty !== null && !isNaN(newQty) && newQty > 0) {
            updateQuantity(cart.length - 1, parseInt(newQty));
        }
    }
    if (e.key === 'F4') {
        e.preventDefault();
        applyDiscount();
    }
    if (e.key === 'F5' && cart.length > 0) {
        e.preventDefault();
        removeFromCart(cart.length - 1);
    }
    if (e.key === 'F9') {
        e.preventDefault();
        checkout();
    }
}

async function searchProduct() {
    const input = document.getElementById('barcode-input');
    const keyword = input.value.trim();
    
    if (!keyword) return;
    
    const products = await Storage.getAll('products');
    const product = products.find(p => 
        p.barcode === keyword || 
        p.name.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (product) {
        addToCart(product);
        input.value = '';
        input.focus();
    } else {
        alert('未找到商品: ' + keyword);
    }
}

function addToCart(product) {
    const existingIndex = cart.findIndex(item => item.barcode === product.barcode);
    
    if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({
            barcode: product.barcode,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    
    renderCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function updateQuantity(index, quantity) {
    if (quantity <= 0) {
        removeFromCart(index);
        return;
    }
    cart[index].quantity = quantity;
    renderCart();
}

function clearCart() {
    if (cart.length === 0) return;
    if (!confirm('确定要清空购物车吗？')) return;
    
    cart = [];
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛒</div>
                <p>购物车是空的</p>
                <p style="font-size: 12px; margin-top: 8px;">扫描条码或点击快捷商品添加</p>
            </div>
        `;
    } else {
        container.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-barcode">${item.barcode}</div>
                </div>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="updateQuantity(${index}, ${item.quantity - 1})">−</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity(${index}, ${item.quantity + 1})">+</button>
                </div>
                <div class="cart-item-price">¥${item.price.toFixed(2)}</div>
                <div class="cart-item-total">¥${(item.price * item.quantity).toFixed(2)}</div>
                <button class="btn-remove" onclick="removeFromCart(${index})">×</button>
            </div>
        `).join('');
    }
    
    updateSummary();
}

function updateSummary() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = 0;
    const total = subtotal - discount;
    
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('subtotal').textContent = `¥${subtotal.toFixed(2)}`;
    document.getElementById('discount').textContent = `-¥${discount.toFixed(2)}`;
    document.getElementById('total-amount').textContent = `¥${total.toFixed(2)}`;
    document.getElementById('checkout-amount').textContent = `¥${total.toFixed(2)}`;
}

async function renderQuickProducts() {
    const container = document.getElementById('quick-products');
    const products = await Storage.getAll('products');
    const quickProducts = products.slice(0, 12);
    
    container.innerHTML = `
        <h3>快捷商品</h3>
        <div class="quick-grid">
            ${quickProducts.map(p => `
                <div class="quick-item" onclick="addToCartByBarcode('${p.barcode}')">
                    <div class="quick-item-name">${p.name}</div>
                    <div class="quick-item-price">¥${p.price.toFixed(2)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

async function addToCartByBarcode(barcode) {
    const products = await Storage.getAll('products');
    const product = products.find(p => p.barcode === barcode);
    if (product) {
        addToCart(product);
    }
}

function applyDiscount() {
    if (cart.length === 0) {
        alert('购物车为空');
        return;
    }
    const discount = prompt('请输入折扣率 (如: 0.9 表示9折):', '1');
    if (discount !== null && !isNaN(discount) && discount > 0 && discount <= 1) {
        cart.forEach(item => {
            item.price = item.price * parseFloat(discount);
        });
        renderCart();
    }
}

// ==================== 结算功能 ====================
function checkout() {
    if (cart.length === 0) {
        alert('购物车为空');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('modal-total').textContent = `¥${total.toFixed(2)}`;
    document.getElementById('received-amount').value = '';
    document.getElementById('change-amount').textContent = '¥0.00';
    
    document.getElementById('checkout-modal').classList.add('active');
    document.getElementById('received-amount').focus();
}

function closeCheckoutModal() {
    document.getElementById('checkout-modal').classList.remove('active');
}

function calculateChange() {
    const total = parseFloat(document.getElementById('modal-total').textContent.replace('¥', ''));
    const received = parseFloat(document.getElementById('received-amount').value) || 0;
    const change = received - total;
    document.getElementById('change-amount').textContent = `¥${change.toFixed(2)}`;
}

async function confirmCheckout() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const received = parseFloat(document.getElementById('received-amount').value) || 0;
    
    if (currentPaymentMethod === 'cash' && received < total) {
        alert('实收金额不足');
        return;
    }
    
    const order = {
        id: generateOrderId(),
        time: new Date().toISOString(),
        items: [...cart],
        total: total,
        paymentMethod: currentPaymentMethod,
        received: received,
        change: received - total
    };
    
    await Storage.addItem('orders', order);
    
    cart = [];
    renderCart();
    
    closeCheckoutModal();
    showReceipt(order);
}

function generateOrderId() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ECO${dateStr}${random}`;
}

// ==================== 小票功能 ====================
async function showReceipt(order) {
    const settings = await Storage.getSettings() || defaultSettings;
    const date = new Date(order.time);
    
    const receiptHtml = `
        <div class="receipt-header">
            <h2>${settings.shopName}</h2>
            <p>${settings.receiptTitle}</p>
            <p>Tel: ${settings.shopPhone || 'N/A'}</p>
        </div>
        <hr class="receipt-divider">
        <div>
            <p>单号: ${order.id}</p>
            <p>时间: ${date.toLocaleString('zh-CN')}</p>
            <p>收银员: 管理员</p>
        </div>
        <hr class="receipt-divider">
        <div class="receipt-items">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px;">
                <span>商品</span>
                <span>数量</span>
                <span>金额</span>
            </div>
            ${order.items.map(item => `
                <div class="receipt-item">
                    <span style="flex: 1;">${item.name}</span>
                    <span style="width: 40px; text-align: center;">${item.quantity}</span>
                    <span style="width: 60px; text-align: right;">¥${(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <div style="font-size: 12px; color: #666;">¥${item.price.toFixed(2)} × ${item.quantity}</div>
            `).join('')}
        </div>
        <hr class="receipt-divider">
        <div>
            <div class="receipt-item receipt-total">
                <span>合计:</span>
                <span>¥${order.total.toFixed(2)}</span>
            </div>
            <div class="receipt-item">
                <span>支付方式:</span>
                <span>${getPaymentMethodName(order.paymentMethod)}</span>
            </div>
            ${order.paymentMethod === 'cash' ? `
            <div class="receipt-item">
                <span>实收:</span>
                <span>¥${order.received.toFixed(2)}</span>
            </div>
            <div class="receipt-item">
                <span>找零:</span>
                <span>¥${order.change.toFixed(2)}</span>
            </div>
            ` : ''}
        </div>
        <hr class="receipt-divider">
        <div class="receipt-footer">
            <p>${settings.receiptFooter}</p>
            <p style="font-size: 12px; margin-top: 8px;">ECO-POS 收银系统</p>
        </div>
    `;
    
    document.getElementById('receipt-content').innerHTML = receiptHtml;
    document.getElementById('receipt-modal').classList.add('active');
}

function closeReceiptModal() {
    document.getElementById('receipt-modal').classList.remove('active');
}

function printReceipt() {
    const receiptContent = document.getElementById('receipt-content').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>打印小票</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0; padding: 10px; }
                .receipt-header { text-align: center; margin-bottom: 10px; }
                .receipt-header h2 { font-size: 16px; margin: 0; }
                hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
                .receipt-item { display: flex; justify-content: space-between; margin-bottom: 4px; }
                .receipt-footer { text-align: center; margin-top: 10px; }
            </style>
        </head>
        <body>
            ${receiptContent}
            <script>window.print(); window.close();<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function getPaymentMethodName(method) {
    const names = { cash: '现金', wechat: '微信支付', alipay: '支付宝', card: '银行卡' };
    return names[method] || method;
}

// ==================== 商品管理 ====================
async function loadProducts() {
    const products = await Storage.getAll('products');
    const categoryFilter = document.getElementById('category-filter').value;
    const searchKeyword = document.getElementById('product-search').value.toLowerCase();
    
    let filtered = products;
    
    if (categoryFilter) {
        filtered = filtered.filter(p => p.category === categoryFilter);
    }
    
    if (searchKeyword) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchKeyword) ||
            p.barcode.includes(searchKeyword)
        );
    }
    
    const tbody = document.getElementById('products-list');
    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>${p.barcode}</td>
            <td>${p.name}</td>
            <td>${getCategoryName(p.category)}</td>
            <td>¥${p.price.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>
                <button class="btn-secondary" onclick="editProduct('${p.barcode}')">编辑</button>
                <button class="btn-danger" onclick="deleteProduct('${p.barcode}')">删除</button>
            </td>
        </tr>
    `).join('');
}

function getCategoryName(category) {
    const names = { food: '食品饮料', daily: '日用百货', digital: '数码电器', clothing: '服装鞋帽', other: '其他' };
    return names[category] || category;
}

function showAddProductModal() {
    editingProduct = null;
    document.getElementById('product-barcode').value = '';
    document.getElementById('product-name').value = '';
    document.getElementById('product-category').value = 'food';
    document.getElementById('product-price').value = '';
    document.getElementById('product-stock').value = '0';
    document.getElementById('product-cost').value = '0';
    document.querySelector('#product-modal .modal-header h3').textContent = '添加商品';
    document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
}

async function saveProduct() {
    const barcode = document.getElementById('product-barcode').value.trim();
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value) || 0;
    const cost = parseFloat(document.getElementById('product-cost').value) || 0;
    
    if (!barcode || !name || isNaN(price)) {
        alert('请填写必填项');
        return;
    }
    
    if (!editingProduct) {
        const products = await Storage.getAll('products');
        if (products.find(p => p.barcode === barcode)) {
            alert('商品条码已存在');
            return;
        }
    }
    
    const product = { barcode, name, category, price, stock, cost };
    await Storage.addItem('products', product);
    
    closeProductModal();
    loadProducts();
    renderQuickProducts();
}

async function editProduct(barcode) {
    const products = await Storage.getAll('products');
    const product = products.find(p => p.barcode === barcode);
    if (!product) return;
    
    editingProduct = barcode;
    document.getElementById('product-barcode').value = product.barcode;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-cost').value = product.cost || 0;
    document.querySelector('#product-modal .modal-header h3').textContent = '编辑商品';
    document.getElementById('product-modal').classList.add('active');
}

async function deleteProduct(barcode) {
    if (!confirm('确定要删除这个商品吗？')) return;
    
    await Storage.deleteItem('products', barcode);
    loadProducts();
    renderQuickProducts();
}

// ==================== 订单记录 ====================
async function loadOrders() {
    const orders = await Storage.getAll('orders');
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    let filtered = orders.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    if (startDate) {
        filtered = filtered.filter(o => new Date(o.time) >= new Date(startDate));
    }
    if (endDate) {
        filtered = filtered.filter(o => new Date(o.time) <= new Date(endDate + 'T23:59:59'));
    }
    
    const tbody = document.getElementById('orders-list');
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-light);">暂无订单记录</td></tr>`;
    } else {
        tbody.innerHTML = filtered.map(order => {
            const date = new Date(order.time);
            return `
                <tr>
                    <td>${order.id}</td>
                    <td>${date.toLocaleString('zh-CN')}</td>
                    <td>${order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                    <td>¥${order.total.toFixed(2)}</td>
                    <td>${getPaymentMethodName(order.paymentMethod)}</td>
                    <td>
                        <button class="btn-secondary" onclick="viewOrder('${order.id}')">查看</button>
                        <button class="btn-secondary" onclick="reprintReceipt('${order.id}')">补打</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function filterOrders() {
    loadOrders();
}

async function viewOrder(orderId) {
    const orders = await Storage.getAll('orders');
    const order = orders.find(o => o.id === orderId);
    if (order) {
        showReceipt(order);
    }
}

async function reprintReceipt(orderId) {
    const orders = await Storage.getAll('orders');
    const order = orders.find(o => o.id === orderId);
    if (order) {
        showReceipt(order);
    }
}

// ==================== 报表功能 ====================
async function loadReports() {
    const orders = await Storage.getAll('orders');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter(o => new Date(o.time) >= today);
    updateReportStats(todayOrders);
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const reportType = btn.dataset.report;
            const allOrders = await Storage.getAll('orders');
            let filteredOrders = [];
            
            const now = new Date();
            
            if (reportType === 'daily') {
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                filteredOrders = allOrders.filter(o => new Date(o.time) >= start);
            } else if (reportType === 'monthly') {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                filteredOrders = allOrders.filter(o => new Date(o.time) >= start);
            } else if (reportType === 'yearly') {
                const start = new Date(now.getFullYear(), 0, 1);
                filteredOrders = allOrders.filter(o => new Date(o.time) >= start);
            }
            
            updateReportStats(filteredOrders);
        });
    });
}

function updateReportStats(orders) {
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = orders.length;
    const avgOrder = orderCount > 0 ? totalSales / orderCount : 0;
    
    document.getElementById('report-sales').textContent = `¥${totalSales.toFixed(2)}`;
    document.getElementById('report-orders').textContent = orderCount;
    document.getElementById('report-avg').textContent = `¥${avgOrder.toFixed(2)}`;
}

// ==================== 设置功能 ====================
async function loadSettings() {
    const settings = await Storage.getSettings() || defaultSettings;
    
    document.getElementById('shop-name').value = settings.shopName;
    document.getElementById('shop-phone').value = settings.shopPhone;
    document.getElementById('shop-address').value = settings.shopAddress;
    document.getElementById('receipt-title').value = settings.receiptTitle;
    document.getElementById('receipt-footer').value = settings.receiptFooter;
    document.getElementById('receipt-copies').value = settings.receiptCopies;
}

async function saveSettings() {
    const settings = {
        shopName: document.getElementById('shop-name').value,
        shopPhone: document.getElementById('shop-phone').value,
        shopAddress: document.getElementById('shop-address').value,
        receiptTitle: document.getElementById('receipt-title').value,
        receiptFooter: document.getElementById('receipt-footer').value,
        receiptCopies: parseInt(document.getElementById('receipt-copies').value) || 1
    };
    
    await Storage.setSettings(settings);
    alert('设置已保存');
}

async function exportData() {
    const data = {
        products: await Storage.getAll('products'),
        orders: await Storage.getAll('orders'),
        settings: await Storage.getSettings(),
        exportTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eco-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// 导入Excel商品数据
async function importExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                
                if (jsonData.length === 0) {
                    alert('Excel文件为空');
                    return;
                }
                
                const newProducts = [];
                const errors = [];
                
                jsonData.forEach((row, index) => {
                    let barcode = row['条码'] || row['条形码'] || row['barcode'] || row['Barcode'];
                    const name = row['商品名称'] || row['名称'] || row['name'] || row['Name'];
                    const category = row['分类'] || row['类别'] || row['category'] || row['Category'] || 'other';
                    const price = parseFloat(row['售价'] || row['价格'] || row['price'] || row['Price']);
                    const stock = parseInt(row['库存'] || row['数量'] || row['stock'] || row['Stock'] || 0);
                    const cost = parseFloat(row['成本价'] || row['成本'] || row['cost'] || row['Cost'] || 0);
                    
                    if (barcode !== undefined && barcode !== null) {
                        barcode = String(barcode);
                        if (barcode.includes('e') || barcode.includes('E')) {
                            barcode = Number(barcode).toFixed(0);
                        }
                        barcode = barcode.trim();
                    }
                    
                    if (!barcode || !name || isNaN(price)) {
                        errors.push(`第${index + 2}行: 数据不完整`);
                        return;
                    }
                    
                    let catCode = 'other';
                    const catLower = String(category).toLowerCase();
                    if (catLower.includes('食品') || catLower.includes('饮料') || catLower.includes('food')) catCode = 'food';
                    else if (catLower.includes('日用') || catLower.includes('百货') || catLower.includes('daily')) catCode = 'daily';
                    else if (catLower.includes('数码') || catLower.includes('电器') || catLower.includes('digital')) catCode = 'digital';
                    else if (catLower.includes('服装') || catLower.includes('鞋帽') || catLower.includes('clothing')) catCode = 'clothing';
                    
                    newProducts.push({ barcode, name: String(name).trim(), category: catCode, price, stock, cost });
                });
                
                if (newProducts.length === 0) {
                    alert('没有有效的商品数据可导入');
                    return;
                }
                
                // 批量导入商品
                for (const product of newProducts) {
                    await Storage.addItem('products', product);
                }
                
                alert(`导入成功! 共导入 ${newProducts.length} 个商品`);
                loadProducts();
                renderQuickProducts();
                
            } catch (err) {
                alert('Excel导入失败: ' + err.message);
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
}

// 下载Excel模板
function downloadTemplate() {
    const wsData = [
        ['条码', '商品名称', '分类', '售价', '库存', '成本价'],
        ['6901234567890', '可口可乐 500ml', '食品饮料', 3.50, 100, 2.00],
        ['6901234567891', '雪碧 500ml', '食品饮料', 3.50, 80, 2.00],
        ['6901234567892', '农夫山泉 550ml', '食品饮料', 2.00, 200, 1.00]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '商品导入模板');
    
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    
    XLSX.writeFile(wb, 'ECO-POS商品导入模板.xlsx');
}

async function clearAllData() {
    if (!confirm('警告：这将清空所有数据！确定要继续吗？')) return;
    if (!confirm('再次确认：此操作不可恢复，确定要清空所有数据吗？')) return;
    
    await Storage.clear('products');
    await Storage.clear('orders');
    cart = [];
    
    alert('所有数据已清空');
    location.reload();
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    
    // 商品管理页面事件
    document.getElementById('product-search').addEventListener('input', loadProducts);
    document.getElementById('category-filter').addEventListener('change', loadProducts);
    
    // 设置默认日期
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('start-date').value = today;
    document.getElementById('end-date').value = today;
});
