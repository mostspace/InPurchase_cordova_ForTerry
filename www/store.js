"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CdvPurchase;
(function (CdvPurchase) {
    let Internal;
    (function (Internal) {
        class StoreAdapterListener {
            constructor(delegate) {
                this.lastTransactionState = {};
                this.delegate = delegate;
            }
            static makeTransactionToken(transaction) {
                return transaction.platform + '|' + transaction.transactionId;
            }
            productsUpdated(platform, products) {
                products.forEach(product => this.delegate.updatedCallbacks.trigger(product));
            }
            receiptsUpdated(platform, receipts) {
                receipts.forEach(receipt => {
                    this.delegate.updatedReceiptCallbacks.trigger(receipt);
                    receipt.transactions.forEach(transaction => {
                        const transactionToken = StoreAdapterListener.makeTransactionToken(transaction);
                        const lastState = this.lastTransactionState[transactionToken];
                        if (transaction.state === CdvPurchase.TransactionState.APPROVED) {
                            this.delegate.approvedCallbacks.trigger(transaction); // better retrigger (so validation is rerun on potential update)
                        }
                        else if (lastState !== transaction.state) {
                            if (transaction.state === CdvPurchase.TransactionState.FINISHED) {
                                this.delegate.finishedCallbacks.trigger(transaction);
                            }
                        }
                        this.lastTransactionState[transactionToken] = transaction.state;
                    });
                });
            }
        }
        Internal.StoreAdapterListener = StoreAdapterListener;
    })(Internal = CdvPurchase.Internal || (CdvPurchase.Internal = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Internal;
    (function (Internal) {
        /**
         * The list of active platform adapters
         */
        class Adapters {
            constructor() {
                this.list = [];
            }
            add(log, adapters, context) {
                adapters.forEach(po => {
                    log.info("");
                    if (this.find(po.platform))
                        return;
                    switch (po.platform) {
                        case CdvPurchase.Platform.APPLE_APPSTORE:
                            return this.list.push(new CdvPurchase.AppleAppStore.Adapter(context));
                        case CdvPurchase.Platform.GOOGLE_PLAY:
                            return this.list.push(new CdvPurchase.GooglePlay.Adapter(context));
                        case CdvPurchase.Platform.BRAINTREE:
                            if (!po.options) {
                                log.error('Options missing for Braintree initialization. Use {platform: Platform.BRAINTREE, options: {...}} in your call to store.initialize');
                            }
                            return this.list.push(new CdvPurchase.Braintree.Adapter(context, po.options));
                        case CdvPurchase.Platform.TEST:
                        default:
                            return this.list.push(new CdvPurchase.Test.Adapter());
                    }
                });
            }
            /**
             * Initialize some platform adapters.
             */
            initialize(platforms = [CdvPurchase.Store.defaultPlatform()], context) {
                return __awaiter(this, void 0, void 0, function* () {
                    const newPlatforms = platforms.map(p => typeof p === 'string' ? { platform: p } : p).filter(p => !this.find(p.platform));
                    const log = context.log.child('Adapters');
                    log.info("Adding platforms: " + JSON.stringify(newPlatforms));
                    this.add(log, newPlatforms, context);
                    const products = context.registeredProducts.byPlatform();
                    const result = yield Promise.all(newPlatforms.map((platformToInit) => __awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c;
                        const platformProducts = (_c = (_b = (_a = products.filter(p => p.platform === platformToInit.platform)) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.products) !== null && _c !== void 0 ? _c : [];
                        const adapter = this.find(platformToInit.platform);
                        if (!adapter)
                            return;
                        log.info(`${adapter.name} initializing...`);
                        const initResult = yield adapter.initialize();
                        log.info(`${adapter.name} initialized. ${initResult && JSON.stringify(initResult)}`);
                        if (initResult === null || initResult === void 0 ? void 0 : initResult.code)
                            return initResult;
                        log.info(`${adapter.name} products: ${JSON.stringify(platformProducts)}`);
                        if (platformProducts.length === 0)
                            return;
                        const loadResult = yield adapter.load(platformProducts);
                        log.info(`${adapter.name} loaded: ${JSON.stringify(loadResult)}`);
                        const loadedProducts = loadResult.filter(p => p instanceof CdvPurchase.Product);
                        context.listener.productsUpdated(platformToInit.platform, loadedProducts);
                        return loadResult.filter(lr => 'code' in lr && 'message' in lr)[0];
                    })));
                    return result.filter(err => err);
                });
            }
            /**
             * Retrieve a platform adapter.
             */
            find(platform) {
                return this.list.filter(a => a.id === platform)[0];
            }
        }
        Internal.Adapters = Adapters;
    })(Internal = CdvPurchase.Internal || (CdvPurchase.Internal = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    /** Manage a list of callbacks */
    class Callbacks {
        constructor() {
            this.callbacks = [];
        }
        push(callback) {
            this.callbacks.push(callback);
        }
        trigger(value) {
            this.callbacks.forEach(cb => setTimeout(cb, 0, value));
        }
    }
    CdvPurchase.Callbacks = Callbacks;
})(CdvPurchase || (CdvPurchase = {}));
//!
//! ## Generating the documentation
//!
//! The documentation is generated by running `make doc`. This command will update doc/api.md and doc/contributor-guide.md
//!
//! The content of those files is retrieve from the typescript source code.
//!
//! Lines starting with "//!" will be included in the contributor documentation.
//! Lines starting with "//:" will be included in the user documentation.
//!
var CdvPurchase;
(function (CdvPurchase) {
    const ERROR_CODES_BASE = 6777000;
    let ErrorCode;
    (function (ErrorCode) {
        /** Error: Failed to intialize the in-app purchase library */
        ErrorCode[ErrorCode["SETUP"] = ERROR_CODES_BASE + 1] = "SETUP";
        /** Error: Failed to load in-app products metadata */
        ErrorCode[ErrorCode["LOAD"] = ERROR_CODES_BASE + 2] = "LOAD";
        /** Error: Failed to make a purchase */
        ErrorCode[ErrorCode["PURCHASE"] = ERROR_CODES_BASE + 3] = "PURCHASE";
        /** Error: Failed to load the purchase receipt */
        ErrorCode[ErrorCode["LOAD_RECEIPTS"] = ERROR_CODES_BASE + 4] = "LOAD_RECEIPTS";
        /** Error: Client is not allowed to issue the request */
        ErrorCode[ErrorCode["CLIENT_INVALID"] = ERROR_CODES_BASE + 5] = "CLIENT_INVALID";
        /** Error: Purchase flow has been cancelled by user */
        ErrorCode[ErrorCode["PAYMENT_CANCELLED"] = ERROR_CODES_BASE + 6] = "PAYMENT_CANCELLED";
        /** Error: Something is suspicious about a purchase */
        ErrorCode[ErrorCode["PAYMENT_INVALID"] = ERROR_CODES_BASE + 7] = "PAYMENT_INVALID";
        /** Error: The user is not allowed to make a payment */
        ErrorCode[ErrorCode["PAYMENT_NOT_ALLOWED"] = ERROR_CODES_BASE + 8] = "PAYMENT_NOT_ALLOWED";
        /** Error: Unknown error */
        ErrorCode[ErrorCode["UNKNOWN"] = ERROR_CODES_BASE + 10] = "UNKNOWN";
        /** Error: Failed to refresh the purchase receipt */
        ErrorCode[ErrorCode["REFRESH_RECEIPTS"] = ERROR_CODES_BASE + 11] = "REFRESH_RECEIPTS";
        /** Error: The product identifier is invalid */
        ErrorCode[ErrorCode["INVALID_PRODUCT_ID"] = ERROR_CODES_BASE + 12] = "INVALID_PRODUCT_ID";
        /** Error: Cannot finalize a transaction or acknowledge a purchase */
        ErrorCode[ErrorCode["FINISH"] = ERROR_CODES_BASE + 13] = "FINISH";
        /** Error: Failed to communicate with the server */
        ErrorCode[ErrorCode["COMMUNICATION"] = ERROR_CODES_BASE + 14] = "COMMUNICATION";
        /** Error: Subscriptions are not available */
        ErrorCode[ErrorCode["SUBSCRIPTIONS_NOT_AVAILABLE"] = ERROR_CODES_BASE + 15] = "SUBSCRIPTIONS_NOT_AVAILABLE";
        /** Error: Purchase information is missing token */
        ErrorCode[ErrorCode["MISSING_TOKEN"] = ERROR_CODES_BASE + 16] = "MISSING_TOKEN";
        /** Error: Verification of store data failed */
        ErrorCode[ErrorCode["VERIFICATION_FAILED"] = ERROR_CODES_BASE + 17] = "VERIFICATION_FAILED";
        /** Error: Bad response from the server */
        ErrorCode[ErrorCode["BAD_RESPONSE"] = ERROR_CODES_BASE + 18] = "BAD_RESPONSE";
        /** Error: Failed to refresh the store */
        ErrorCode[ErrorCode["REFRESH"] = ERROR_CODES_BASE + 19] = "REFRESH";
        /** Error: Payment has expired */
        ErrorCode[ErrorCode["PAYMENT_EXPIRED"] = ERROR_CODES_BASE + 20] = "PAYMENT_EXPIRED";
        /** Error: Failed to download the content */
        ErrorCode[ErrorCode["DOWNLOAD"] = ERROR_CODES_BASE + 21] = "DOWNLOAD";
        /** Error: Failed to update a subscription */
        ErrorCode[ErrorCode["SUBSCRIPTION_UPDATE_NOT_AVAILABLE"] = ERROR_CODES_BASE + 22] = "SUBSCRIPTION_UPDATE_NOT_AVAILABLE";
        /** Error: The requested product is not available in the store. */
        ErrorCode[ErrorCode["PRODUCT_NOT_AVAILABLE"] = ERROR_CODES_BASE + 23] = "PRODUCT_NOT_AVAILABLE";
        /** Error: The user has not allowed access to Cloud service information */
        ErrorCode[ErrorCode["CLOUD_SERVICE_PERMISSION_DENIED"] = ERROR_CODES_BASE + 24] = "CLOUD_SERVICE_PERMISSION_DENIED";
        /** Error: The device could not connect to the network. */
        ErrorCode[ErrorCode["CLOUD_SERVICE_NETWORK_CONNECTION_FAILED"] = ERROR_CODES_BASE + 25] = "CLOUD_SERVICE_NETWORK_CONNECTION_FAILED";
        /** Error: The user has revoked permission to use this cloud service. */
        ErrorCode[ErrorCode["CLOUD_SERVICE_REVOKED"] = ERROR_CODES_BASE + 26] = "CLOUD_SERVICE_REVOKED";
        /** Error: The user has not yet acknowledged Apple’s privacy policy */
        ErrorCode[ErrorCode["PRIVACY_ACKNOWLEDGEMENT_REQUIRED"] = ERROR_CODES_BASE + 27] = "PRIVACY_ACKNOWLEDGEMENT_REQUIRED";
        /** Error: The app is attempting to use a property for which it does not have the required entitlement. */
        ErrorCode[ErrorCode["UNAUTHORIZED_REQUEST_DATA"] = ERROR_CODES_BASE + 28] = "UNAUTHORIZED_REQUEST_DATA";
        /** Error: The offer identifier is invalid. */
        ErrorCode[ErrorCode["INVALID_OFFER_IDENTIFIER"] = ERROR_CODES_BASE + 29] = "INVALID_OFFER_IDENTIFIER";
        /** Error: The price you specified in App Store Connect is no longer valid. */
        ErrorCode[ErrorCode["INVALID_OFFER_PRICE"] = ERROR_CODES_BASE + 30] = "INVALID_OFFER_PRICE";
        /** Error: The signature in a payment discount is not valid. */
        ErrorCode[ErrorCode["INVALID_SIGNATURE"] = ERROR_CODES_BASE + 31] = "INVALID_SIGNATURE";
        /** Error: Parameters are missing in a payment discount. */
        ErrorCode[ErrorCode["MISSING_OFFER_PARAMS"] = ERROR_CODES_BASE + 32] = "MISSING_OFFER_PARAMS";
    })(ErrorCode = CdvPurchase.ErrorCode || (CdvPurchase.ErrorCode = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["QUIET"] = 0] = "QUIET";
        LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
        LogLevel[LogLevel["WARNING"] = 2] = "WARNING";
        LogLevel[LogLevel["INFO"] = 3] = "INFO";
        LogLevel[LogLevel["DEBUG"] = 4] = "DEBUG";
    })(LogLevel = CdvPurchase.LogLevel || (CdvPurchase.LogLevel = {}));
    ;
    class Logger {
        constructor(store, prefix = '') {
            this.prefix = '';
            this.store = store;
            this.prefix = prefix || 'CordovaPurchase';
        }
        child(prefix) {
            return new Logger(this.store, this.prefix + '.' + prefix);
        }
        /// ### `store.log.error(message)`
        /// Logs an error message, only if `store.verbosity` >= store.ERROR
        error(o) {
            log(this.store.verbosity, LogLevel.ERROR, this.prefix, o);
            // show the stack trace
            try {
                throw new Error(toString(o));
            }
            catch (e) {
                log(this.store.verbosity, LogLevel.ERROR, this.prefix, e.stack);
            }
        }
        /// ### `store.log.warn(message)`
        /// Logs a warning message, only if `store.verbosity` >= store.WARNING
        warn(o) { log(this.store.verbosity, LogLevel.WARNING, this.prefix, o); }
        /// ### `store.log.info(message)`
        /// Logs an info message, only if `store.verbosity` >= store.INFO
        info(o) { log(this.store.verbosity, LogLevel.INFO, this.prefix, o); }
        /// ### `store.log.debug(message)`
        /// Logs a debug message, only if `store.verbosity` >= store.DEBUG
        debug(o) { log(this.store.verbosity, LogLevel.DEBUG, this.prefix, o); }
        /**
         * Add warning logs on a console describing an exceptions.
         *
         * This method is mostly used when executing user registered callbacks.
         *
         * @param context - a string describing why the method was called
         * @param error - a javascript Error object thrown by a exception
         */
        logCallbackException(context, err) {
            this.warn("A callback in \'" + context + "\' failed with an exception.");
            if (typeof err === 'string')
                this.warn("           " + err);
            else if (err) {
                const errAny = err;
                if (errAny.fileName)
                    this.warn("           " + errAny.fileName + ":" + errAny.lineNumber);
                if (err.message)
                    this.warn("           " + err.message);
                if (err.stack)
                    this.warn("           " + err.stack);
            }
        }
    }
    CdvPurchase.Logger = Logger;
    const LOG_LEVEL_STRING = ["QUIET", "ERROR", "WARNING", "INFO", "DEBUG"];
    function toString(o) {
        if (typeof o !== 'string')
            o = JSON.stringify(o);
        return o;
    }
    function log(verbosity, level, prefix, o) {
        var maxLevel = verbosity === true ? 1 : verbosity;
        if (level > maxLevel)
            return;
        if (typeof o !== 'string')
            o = JSON.stringify(o);
        const fullPrefix = prefix ? `[${prefix}] ` : '';
        const logStr = (level === LogLevel.ERROR) ? ((str) => console.error(str))
            : (level === LogLevel.WARNING) ? ((str) => console.warn(str))
                : ((str) => console.log(str));
        if (LOG_LEVEL_STRING[level])
            logStr(`${fullPrefix}${LOG_LEVEL_STRING[level]}: ${o}`);
        else
            logStr(`${fullPrefix}${o}`);
    }
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Utils;
    (function (Utils) {
        Utils.nonEnumerable = (target, name, desc) => {
            if (desc) {
                desc.enumerable = false;
                return desc;
            }
            Object.defineProperty(target, name, {
                set(value) {
                    Object.defineProperty(this, name, {
                        value, writable: true, configurable: true,
                    });
                },
                configurable: true,
            });
        };
    })(Utils = CdvPurchase.Utils || (CdvPurchase.Utils = {}));
})(CdvPurchase || (CdvPurchase = {}));
/// <reference path="utils/non-enumerable.ts" />
var CdvPurchase;
(function (CdvPurchase) {
    class Offer {
        constructor(options) {
            this.id = options.id;
            this.product = options.product;
            this.pricingPhases = options.pricingPhases;
            Object.defineProperty(this, 'productId', { enumerable: true, get: () => this.product.id });
            Object.defineProperty(this, 'platform', { enumerable: true, get: () => this.product.platform });
        }
    }
    __decorate([
        CdvPurchase.Utils.nonEnumerable
    ], Offer.prototype, "product", void 0);
    CdvPurchase.Offer = Offer;
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    /** Product definition from a store */
    class Product {
        constructor(p) {
            /** Product title from the store. */
            this.title = '';
            /** Product full description from the store. */
            this.description = '';
            this.platform = p.platform;
            this.type = p.type;
            this.id = p.id;
            this.offers = [];
            Object.defineProperty(this, 'pricing', { enumerable: false });
        }
        /**
         * Shortcut to offers[0].pricingPhases[0]
         *
         * Useful when you know products have a single offer and a single pricing phase.
         */
        get pricing() { var _a; return (_a = this.offers[0]) === null || _a === void 0 ? void 0 : _a.pricingPhases[0]; }
        /**
         * Find and return an offer for this product from its id
         *
         * If id isn't specified, returns the first offer.
         *
         * @param id - Identifier of the offer to return
         * @return An Offer or undefined if no match is found
         */
        getOffer(id = '') {
            if (!id)
                return this.offers[0];
            return this.offers.find(o => o.id === id);
        }
        /**
         * Find and return an offer for this product from its id
         *
         * If id isn't specified, returns the first offer.
         *
         * @param id - Identifier of the offer to return
         */
        addOffer(offer) {
            if (this.getOffer(offer.id))
                return;
            this.offers.push(offer);
        }
    }
    CdvPurchase.Product = Product;
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    /** Ready callbacks */
    class ReadyCallbacks {
        constructor() {
            /** True when the plugin is ready */
            this.isReady = false;
            /** Callbacks when the store is ready */
            this.readyCallbacks = [];
        }
        /** Register a callback to be called when the plugin is ready. */
        add(cb) {
            if (this.isReady)
                return setTimeout(cb, 0);
            this.readyCallbacks.push(cb);
        }
        /** Calls the ready callbacks */
        trigger() {
            this.isReady = true;
            this.readyCallbacks.forEach(cb => setTimeout(cb, 0));
            this.readyCallbacks = [];
        }
    }
    CdvPurchase.ReadyCallbacks = ReadyCallbacks;
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    class Receipt {
        constructor(options) {
            this.platform = options.platform;
            this.transactions = options.transactions;
        }
        // async verify(): Promise<IError | undefined> {
        //     return {
        //         code: ErrorCode.VERIFICATION_FAILED,
        //         message: 'TODO: Not implemented yet',
        //     };
        // }
        hasTransaction(value) {
            return !!this.transactions.find(t => t === value);
        }
    }
    CdvPurchase.Receipt = Receipt;
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Internal;
    (function (Internal) {
        class RegisteredProducts {
            constructor() {
                this.list = [];
            }
            find(platform, id) {
                return this.list.find(rp => rp.platform === platform && rp.id === id);
            }
            add(product) {
                const products = Array.isArray(product) ? product : [product];
                const newProducts = products.filter(p => !this.find(p.platform, p.id));
                for (const p of newProducts)
                    this.list.push(p);
            }
            byPlatform() {
                const byPlatform = {};
                this.list.forEach(p => {
                    byPlatform[p.platform] = (byPlatform[p.platform] || []).concat(p);
                });
                return Object.keys(byPlatform).map(platform => ({
                    platform: platform,
                    products: byPlatform[platform]
                }));
            }
        }
        Internal.RegisteredProducts = RegisteredProducts;
    })(Internal = CdvPurchase.Internal || (CdvPurchase.Internal = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    /** Retry failed requests
     *
     * When setup and/or load failed, the plugin will retry over and over till it can connect
     * to the store.
     *
     * However, to be nice with the battery, it'll double the retry timeout each time.
     *
     * Special case, when the device goes online, it'll trigger all retry callback in the queue.
     */
    class Retry {
        constructor(minTimeout = 5000, maxTimeout = 120000) {
            this.maxTimeout = 120000;
            this.minTimeout = 5000;
            this.retryTimeout = 5000;
            this.retries = [];
            this.minTimeout = minTimeout;
            this.maxTimeout = maxTimeout;
            this.retryTimeout = minTimeout;
            document.addEventListener("online", () => {
                const a = this.retries;
                this.retries = [];
                this.retryTimeout = this.minTimeout;
                for (var i = 0; i < a.length; ++i) {
                    clearTimeout(a[i].tid);
                    a[i].fn.call(this);
                }
            }, false);
        }
        retry(fn) {
            var tid = setTimeout(() => {
                this.retries = this.retries.filter(function (o) {
                    return tid !== o.tid;
                });
                fn();
            }, this.retryTimeout);
            this.retries.push({ tid: tid, fn: fn });
            this.retryTimeout *= 2;
            // Max out the waiting time to 2 minutes.
            if (this.retryTimeout > this.maxTimeout)
                this.retryTimeout = this.maxTimeout;
        }
    }
    CdvPurchase.Retry = Retry;
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Internal;
    (function (Internal) {
        /** Queue of receipts to validate */
        class ReceiptsToValidate {
            constructor() {
                this.array = [];
            }
            get() {
                return this.array.concat();
            }
            add(receipt) {
                if (!this.has(receipt))
                    this.array.push(receipt);
            }
            clear() {
                while (this.array.length !== 0)
                    this.array.pop();
            }
            has(receipt) {
                return !!this.array.find(el => el === receipt);
            }
        }
        Internal.ReceiptsToValidate = ReceiptsToValidate;
        /** Handles communication with the remote receipt validation service */
        class Validator {
            constructor(controller, log) {
                /** List of receipts waiting for validation */
                this.receiptsToValidate = new ReceiptsToValidate();
                /** List of verified receipts */
                this.verifiedReceipts = [];
                this.controller = controller;
                this.log = log.child('Validator');
            }
            /** Add/update a verified receipt from the server response */
            addVerifiedReceipt(receipt, data) {
                for (const vr of this.verifiedReceipts) {
                    if (vr.platform === receipt.platform && vr.id === data.id) {
                        // update existing receipt
                        vr.set(receipt, data);
                        return vr;
                    }
                }
                const newVR = new CdvPurchase.VerifiedReceipt(receipt, data);
                this.verifiedReceipts.push(newVR);
                return newVR;
            }
            /** Add a receipt to the validation queue. It'll get validated after a few milliseconds. */
            add(receiptOrTransaction) {
                this.log.debug("Schedule validation: " + JSON.stringify(receiptOrTransaction));
                const receipt = (receiptOrTransaction instanceof CdvPurchase.Transaction)
                    ? this.controller.localReceipts.filter(r => r.hasTransaction(receiptOrTransaction)).slice(-1)[0]
                    : receiptOrTransaction;
                if (receipt) {
                    this.receiptsToValidate.add(receipt);
                }
            }
            /** Run validation for all receipts in the queue */
            run() {
                // pseudo implementation
                const receipts = this.receiptsToValidate.get();
                this.receiptsToValidate.clear();
                const onResponse = (r) => __awaiter(this, void 0, void 0, function* () {
                    const { receipt, payload } = r;
                    const adapter = this.controller.adapters.find(receipt.platform);
                    yield (adapter === null || adapter === void 0 ? void 0 : adapter.handleReceiptValidationResponse(receipt, payload));
                    if (payload.ok) {
                        const vr = this.addVerifiedReceipt(receipt, payload.data);
                        this.controller.verifiedCallbacks.trigger(vr);
                        // this.verifiedCallbacks.trigger(data.receipt);
                    }
                    // else {
                    // }
                    // TODO: update transactions
                });
                receipts.forEach(receipt => this.runOnReceipt(receipt, onResponse));
            }
            runOnReceipt(receipt, callback) {
                if (!this.controller.validator)
                    return;
                if (typeof this.controller.validator === 'function')
                    return this.runValidatorFunction(this.controller.validator, receipt, callback);
                const target = typeof this.controller.validator === 'string'
                    ? { url: this.controller.validator }
                    : this.controller.validator;
                const body = this.buildRequestBody(receipt);
                if (!body)
                    return;
                return this.runValidatorRequest(target, receipt, body, callback);
            }
            runValidatorFunction(validator, receipt, callback) {
                try {
                    validator(receipt, (payload) => callback({ receipt, payload }));
                }
                catch (error) {
                    this.log.warn("user provided validator function failed with error: " + (error === null || error === void 0 ? void 0 : error.stack));
                }
            }
            buildRequestBody(receipt) {
                var _a, _b, _c;
                // Let the adapter generate the initial content
                const adapter = this.controller.adapters.find(receipt.platform);
                const body = adapter === null || adapter === void 0 ? void 0 : adapter.receiptValidationBody(receipt);
                if (!body)
                    return;
                // Add the applicationUsername
                body.additionalData = Object.assign(Object.assign({}, (_a = body.additionalData) !== null && _a !== void 0 ? _a : {}), { applicationUsername: this.controller.getApplicationUsername() });
                if (!body.additionalData.applicationUsername)
                    delete body.additionalData.applicationUsername;
                // Add device information
                body.device = Object.assign(Object.assign({}, (_b = body.device) !== null && _b !== void 0 ? _b : {}), CdvPurchase.Validator.Internal.getDeviceInfo(this.controller));
                // Add legacy pricing information
                if (((_c = body.offers) === null || _c === void 0 ? void 0 : _c.length) === 1) {
                    const offer = body.offers[0];
                    if (offer.pricingPhases.length === 1) {
                        const pricing = offer.pricingPhases[0];
                        body.currency = pricing.currency;
                        body.priceMicros = pricing.priceMicros;
                    }
                    else if (offer.pricingPhases.length === 2) {
                        const pricing = offer.pricingPhases[1];
                        body.currency = pricing.currency;
                        body.priceMicros = pricing.priceMicros;
                        const intro = offer.pricingPhases[0];
                        body.introPriceMicros = intro.priceMicros;
                    }
                }
                return body;
            }
            runValidatorRequest(target, receipt, body, callback) {
                CdvPurchase.Utils.ajax(this.log.child("Ajax"), {
                    url: target.url,
                    method: 'POST',
                    customHeaders: target.headers,
                    data: body,
                    success: (response) => {
                        var _a;
                        this.log.debug("validator success, response: " + JSON.stringify(response));
                        if (!isValidatorResponsePayload(response))
                            return callback({
                                receipt,
                                payload: {
                                    ok: false,
                                    code: CdvPurchase.ErrorCode.BAD_RESPONSE,
                                    message: 'Validator responded with invalid data',
                                    data: { latest_receipt: (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.latest_receipt },
                                }
                            });
                        callback({ receipt, payload: response });
                    },
                    error: (status, message, data) => {
                        var fullMessage = "Error " + status + ": " + message;
                        this.log.debug("validator failed, response: " + JSON.stringify(fullMessage));
                        this.log.debug("body => " + JSON.stringify(data));
                        callback({
                            receipt,
                            payload: {
                                ok: false,
                                message: fullMessage,
                                data: {},
                            }
                        });
                    }
                });
            }
        }
        Internal.Validator = Validator;
        /**
         * Check if a payload looks like a valid validator response.
         */
        function isValidatorResponsePayload(payload) {
            // TODO: could be made more robust.
            return (!!payload)
                && (typeof payload === 'object')
                && ('ok' in payload)
                && (typeof payload.ok === 'boolean');
        }
    })(Internal = CdvPurchase.Internal || (CdvPurchase.Internal = {}));
})(CdvPurchase || (CdvPurchase = {}));
/// <reference path="validator/validator.ts" />
/// <reference path="adapters.ts" />
/// <reference path="log.ts" />
/// <reference path="callbacks.ts" />
/// <reference path="ready.ts" />
var CdvPurchase;
(function (CdvPurchase) {
    CdvPurchase.PLUGIN_VERSION = '13.0.0';
    /** Singleton */
    let globalStore;
    /**
     * Main class of the purchase.
     */
    class Store {
        constructor() {
            /** Payment platform adapters */
            this.adapters = new CdvPurchase.Internal.Adapters();
            /** List of registered products */
            this.registeredProducts = new CdvPurchase.Internal.RegisteredProducts();
            /** Logger */
            this.log = new CdvPurchase.Logger(this);
            /** Verbosity level for log */
            this.verbosity = CdvPurchase.LogLevel.ERROR;
            /** List of callbacks for the "ready" events */
            this._readyCallbacks = new CdvPurchase.ReadyCallbacks();
            /** Callbacks when a product definition was updated */
            this.updatedCallbacks = new CdvPurchase.Callbacks();
            /** Callback when a receipt was updated */
            this.updatedReceiptsCallbacks = new CdvPurchase.Callbacks();
            /** Callbacks when a product is owned */
            // private ownedCallbacks = new Callbacks<Product>();
            /** Callbacks when a transaction has been approved */
            this.approvedCallbacks = new CdvPurchase.Callbacks();
            /** Callbacks when a transaction has been finished */
            this.finishedCallbacks = new CdvPurchase.Callbacks();
            /** Callbacks when a receipt has been validated */
            this.verifiedCallbacks = new CdvPurchase.Callbacks();
            /** Callbacks for errors */
            this.errorCallbacks = new CdvPurchase.Callbacks;
            this.version = CdvPurchase.PLUGIN_VERSION;
            this.listener = new CdvPurchase.Internal.StoreAdapterListener({
                updatedCallbacks: this.updatedCallbacks,
                updatedReceiptCallbacks: this.updatedReceiptsCallbacks,
                approvedCallbacks: this.approvedCallbacks,
                finishedCallbacks: this.finishedCallbacks,
            });
            const store = this;
            this._validator = new CdvPurchase.Internal.Validator({
                adapters: this.adapters,
                getApplicationUsername: this.getApplicationUsername.bind(this),
                get localReceipts() { return store.localReceipts; },
                get validator() { return store.validator; },
                get validator_privacy_policy() { return store.validator_privacy_policy; },
                verifiedCallbacks: this.verifiedCallbacks,
            }, this.log);
        }
        /** The singleton store object */
        static get instance() {
            if (globalStore) {
                return globalStore;
            }
            else {
                globalStore = new Store();
                Object.assign(globalStore, CdvPurchase.LogLevel, CdvPurchase.ProductType, CdvPurchase.ErrorCode); // for backward compatibility
                return globalStore;
            }
        }
        /** Get the application username as a string by either calling or returning Store.applicationUsername */
        getApplicationUsername() {
            if (this.applicationUsername instanceof Function)
                return this.applicationUsername();
            return this.applicationUsername;
        }
        /** Register a product */
        register(product) {
            this.registeredProducts.add(product);
        }
        /**
         * Call to initialize the in-app purchase plugin.
         *
         * @param platforms - List of payment platforms to initialize, default to Store.defaultPlatform().
         */
        initialize(platforms = [Store.defaultPlatform()]) {
            return __awaiter(this, void 0, void 0, function* () {
                const store = this;
                const ret = this.adapters.initialize(platforms, {
                    error: this.error.bind(this),
                    get verbosity() { return store.verbosity; },
                    getApplicationUsername() { return store.getApplicationUsername(); },
                    listener: this.listener,
                    log: this.log,
                    registeredProducts: this.registeredProducts,
                });
                ret.then(() => this._readyCallbacks.trigger());
                return ret;
            });
        }
        /**
         * @deprecated - use store.initialize(), store.update() or store.restorePurchases()
         */
        refresh() {
            throw new Error("use store.initialize() or store.update()");
        }
        /**
         * Call to refresh the price of products and status of purchases.
         */
        update() {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                // Load products metadata
                for (const registration of this.registeredProducts.byPlatform()) {
                    const products = yield ((_a = this.adapters.find(registration.platform)) === null || _a === void 0 ? void 0 : _a.load(registration.products));
                    products === null || products === void 0 ? void 0 : products.forEach(p => {
                        if (p instanceof CdvPurchase.Product)
                            this.updatedCallbacks.trigger(p);
                    });
                }
            });
        }
        /** Register a callback to be called when the plugin is ready. */
        ready(cb) { this._readyCallbacks.add(cb); }
        /** Setup events listener.
         *
         * @example
         * store.when()
         *      .productUpdated(product => updateUI(product))
         *      .approved(transaction => store.finish(transaction));
         */
        when() {
            const ret = {
                productUpdated: (cb) => (this.updatedCallbacks.push(cb), ret),
                receiptUpdated: (cb) => (this.updatedReceiptsCallbacks.push(cb), ret),
                updated: (cb) => (this.updatedCallbacks.push(cb), this.updatedReceiptsCallbacks.push(cb), ret),
                // owned: (cb: Callback<Product>) => (this.ownedCallbacks.push(cb), ret),
                approved: (cb) => (this.approvedCallbacks.push(cb), ret),
                finished: (cb) => (this.finishedCallbacks.push(cb), ret),
                verified: (cb) => (this.verifiedCallbacks.push(cb), ret),
            };
            return ret;
        }
        /** List of all active products */
        get products() {
            // concatenate products all all active platforms
            return [].concat(...this.adapters.list.map(a => a.products));
        }
        /** Find a product from its id and platform */
        get(productId, platform = Store.defaultPlatform()) {
            var _a;
            return (_a = this.adapters.find(platform)) === null || _a === void 0 ? void 0 : _a.products.find(p => p.id === productId);
        }
        /** List of all receipts present on the device */
        get localReceipts() {
            // concatenate products all all active platforms
            return [].concat(...this.adapters.list.map(a => a.receipts));
        }
        /** List of receipts verified with the receipt validation service.
         *
         * Those receipt contains more information and are generally more up-to-date than the local ones. */
        get verifiedReceipts() {
            return this._validator.verifiedReceipts;
        }
        /**
         * Find the last verified purchase for a given product, from those verified by the receipt validator.
         */
        findInVerifiedReceipts(product) {
            var _a, _b;
            let found;
            for (const receipt of this.verifiedReceipts) {
                if (receipt.platform !== product.platform)
                    continue;
                for (const purchase of receipt.collection) {
                    if (purchase.id === product.id) {
                        if (((_a = found === null || found === void 0 ? void 0 : found.purchaseDate) !== null && _a !== void 0 ? _a : 0) < ((_b = purchase.purchaseDate) !== null && _b !== void 0 ? _b : 1))
                            found = purchase;
                    }
                }
            }
            return found;
        }
        /**
         * Find the latest transaction for a givne product, from those reported by the device.
         */
        findInLocalReceipts(product) {
            var _a, _b;
            let found;
            for (const receipt of this.localReceipts) {
                if (receipt.platform !== product.platform)
                    continue;
                for (const transaction of receipt.transactions) {
                    for (const trProducts of transaction.products) {
                        if (trProducts.productId === product.id) {
                            if (((_a = transaction.purchaseDate) !== null && _a !== void 0 ? _a : 0) < ((_b = found === null || found === void 0 ? void 0 : found.purchaseDate) !== null && _b !== void 0 ? _b : 1))
                                found = transaction;
                        }
                    }
                }
            }
            return found;
        }
        /** Place an order for a given offer */
        order(offer, additionalData) {
            return __awaiter(this, void 0, void 0, function* () {
                const adapter = this.adapters.find(offer.product.platform);
                if (!adapter)
                    return {
                        code: CdvPurchase.ErrorCode.PAYMENT_NOT_ALLOWED,
                        message: 'Adapter not found for this platform (' + offer.product.platform + ')',
                    };
                return adapter.order(offer, additionalData || {});
            });
        }
        /** Request a payment */
        requestPayment(paymentRequest, additionalData) {
            return __awaiter(this, void 0, void 0, function* () {
                const adapter = this.adapters.find(paymentRequest.platform);
                if (!adapter)
                    return;
                return adapter.requestPayment(paymentRequest, additionalData);
            });
        }
        /** Verify a receipt or transacting with the receipt validation service. */
        verify(receiptOrTransaction) {
            return __awaiter(this, void 0, void 0, function* () {
                this._validator.add(receiptOrTransaction);
                // Run validation after 50ms, so if the same receipt is to be validated multiple times it will just create one call.
                setTimeout(() => this._validator.run());
            });
        }
        /** Finalize a transaction */
        finish(receipt) {
            return __awaiter(this, void 0, void 0, function* () {
                const transactions = receipt instanceof CdvPurchase.VerifiedReceipt
                    ? receipt.sourceReceipt.transactions
                    : receipt instanceof CdvPurchase.Receipt
                        ? receipt.transactions
                        : [receipt];
                transactions.forEach(transaction => {
                    var _a;
                    const adapter = (_a = this.adapters.find(transaction.platform)) === null || _a === void 0 ? void 0 : _a.finish(transaction);
                });
            });
        }
        restorePurchases() {
            return __awaiter(this, void 0, void 0, function* () {
                // TODO
            });
        }
        /**
         * The default payment platform to use depending on the OS.
         *
         * - on iOS: `APPLE_APPSTORE`
         * - on Android: `GOOGLE_PLAY`
         */
        static defaultPlatform() {
            switch (window.cordova.platformId) {
                case 'android': return CdvPurchase.Platform.GOOGLE_PLAY;
                case 'ios': return CdvPurchase.Platform.APPLE_APPSTORE;
                default: return CdvPurchase.Platform.TEST;
            }
        }
        error(error) {
            if (error instanceof Function)
                this.errorCallbacks.push(error);
            else
                this.errorCallbacks.trigger(error);
        }
    }
    CdvPurchase.Store = Store;
})(CdvPurchase || (CdvPurchase = {}));
setTimeout(() => {
    window.CdvPurchase = CdvPurchase;
    window.CdvPurchase.store = CdvPurchase.Store.instance;
}, 0);
var CdvPurchase;
(function (CdvPurchase) {
    class Transaction {
        constructor(platform) {
            /** Transaction identifier. */
            this.transactionId = '';
            /** State this transaction is in */
            this.state = CdvPurchase.TransactionState.UNKNOWN_STATE;
            /** Purchased products */
            this.products = [];
            this.platform = platform;
        }
    }
    CdvPurchase.Transaction = Transaction;
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    /** Types of In-App-Products */
    let ProductType;
    (function (ProductType) {
        /** Type: An consumable product, that can be purchased multiple time */
        ProductType["CONSUMABLE"] = "consumable";
        /** Type: A non-consumable product, that can purchased only once and the user keeps forever */
        ProductType["NON_CONSUMABLE"] = "non consumable";
        /** @deprecated use PAID_SUBSCRIPTION */
        ProductType["FREE_SUBSCRIPTION"] = "free subscription";
        /** Type: An auto-renewable subscription */
        ProductType["PAID_SUBSCRIPTION"] = "paid subscription";
        /** Type: An non-renewing subscription */
        ProductType["NON_RENEWING_SUBSCRIPTION"] = "non renewing subscription";
        /** Type: The application bundle */
        ProductType["APPLICATION"] = "application";
    })(ProductType = CdvPurchase.ProductType || (CdvPurchase.ProductType = {}));
    /**
     * Type of recurring payment
     *
     * - FINITE_RECURRING: Payment recurs for a fixed number of billing period set in `paymentPhase.cycles`.
     * - INFINITE_RECURRING: Payment recurs for infinite billing periods unless cancelled.
     * - NON_RECURRING: A one time charge that does not repeat.
     */
    let RecurrenceMode;
    (function (RecurrenceMode) {
        RecurrenceMode["NON_RECURRING"] = "NON_RECURRING";
        RecurrenceMode["FINITE_RECURRING"] = "FINITE_RECURRING";
        RecurrenceMode["INFINITE_RECURRING"] = "INFINITE_RECURRING";
    })(RecurrenceMode = CdvPurchase.RecurrenceMode || (CdvPurchase.RecurrenceMode = {}));
    let PaymentMode;
    (function (PaymentMode) {
        PaymentMode["PAY_AS_YOU_GO"] = "PayAsYouGo";
        PaymentMode["UP_FRONT"] = "UpFront";
        PaymentMode["FREE_TRIAL"] = "FreeTrial";
    })(PaymentMode = CdvPurchase.PaymentMode || (CdvPurchase.PaymentMode = {}));
    let Platform;
    (function (Platform) {
        /** Apple AppStore */
        Platform["APPLE_APPSTORE"] = "ios-appstore";
        /** Google Play */
        Platform["GOOGLE_PLAY"] = "android-playstore";
        /** Windows Store */
        Platform["WINDOWS_STORE"] = "windows-store-transaction";
        /** Braintree */
        Platform["BRAINTREE"] = "braintree";
        // /** Stripe */
        // STRIPE = 'stripe',
        /** Test platform */
        Platform["TEST"] = "dummy-store";
    })(Platform = CdvPurchase.Platform || (CdvPurchase.Platform = {}));
    /** Possible states of a product */
    let TransactionState;
    (function (TransactionState) {
        // REQUESTED = 'requested',
        TransactionState["INITIATED"] = "initiated";
        TransactionState["APPROVED"] = "approved";
        TransactionState["CANCELLED"] = "cancelled";
        TransactionState["FINISHED"] = "finished";
        // OWNED = 'owned',
        // EXPIRED = 'expired',
        TransactionState["UNKNOWN_STATE"] = "";
    })(TransactionState = CdvPurchase.TransactionState || (CdvPurchase.TransactionState = {}));
    /** Whether or not the user intends to let the subscription auto-renew. */
    let RenewalIntent;
    (function (RenewalIntent) {
        /** The user intends to let the subscription expire without renewing. */
        RenewalIntent["LAPSE"] = "Lapse";
        /** The user intends to renew the subscription. */
        RenewalIntent["RENEW"] = "Renew";
    })(RenewalIntent = CdvPurchase.RenewalIntent || (CdvPurchase.RenewalIntent = {}));
    /** Whether or not the user was notified or agreed to a price change */
    let PriceConsentStatus;
    (function (PriceConsentStatus) {
        PriceConsentStatus["NOTIFIED"] = "Notified";
        PriceConsentStatus["AGREED"] = "Agreed";
    })(PriceConsentStatus = CdvPurchase.PriceConsentStatus || (CdvPurchase.PriceConsentStatus = {}));
    /** Reason why a subscription has been canceled */
    let CancelationReason;
    (function (CancelationReason) {
        /** Not canceled */
        CancelationReason["NOT_CANCELED"] = "";
        /** Subscription canceled by the developer. */
        CancelationReason["DEVELOPER"] = "Developer";
        /** Subscription canceled by the system for an unspecified reason. */
        CancelationReason["SYSTEM"] = "System";
        /** Subscription upgraded or downgraded to a new subscription. */
        CancelationReason["SYSTEM_REPLACED"] = "System.Replaced";
        /** Product not available for purchase at the time of renewal. */
        CancelationReason["SYSTEM_PRODUCT_UNAVAILABLE"] = "System.ProductUnavailable";
        /** Billing error; for example customer’s payment information is no longer valid. */
        CancelationReason["SYSTEM_BILLING_ERROR"] = "System.BillingError";
        /** Transaction is gone; It has been deleted. */
        CancelationReason["SYSTEM_DELETED"] = "System.Deleted";
        /** Subscription canceled by the user for an unspecified reason. */
        CancelationReason["CUSTOMER"] = "Customer";
        /** Customer canceled their transaction due to an actual or perceived issue within your app. */
        CancelationReason["CUSTOMER_TECHNICAL_ISSUES"] = "Customer.TechnicalIssues";
        /** Customer did not agree to a recent price increase. See also priceConsentStatus. */
        CancelationReason["CUSTOMER_PRICE_INCREASE"] = "Customer.PriceIncrease";
        /** Customer canceled for cost-related reasons. */
        CancelationReason["CUSTOMER_COST"] = "Customer.Cost";
        /** Customer claimed to have found a better app. */
        CancelationReason["CUSTOMER_FOUND_BETTER_APP"] = "Customer.FoundBetterApp";
        /** Customer did not feel he is using this service enough. */
        CancelationReason["CUSTOMER_NOT_USEFUL_ENOUGH"] = "Customer.NotUsefulEnough";
        /** Subscription canceled for another reason; for example, if the customer made the purchase accidentally. */
        CancelationReason["CUSTOMER_OTHER_REASON"] = "Customer.OtherReason";
        /** Subscription canceled for unknown reasons. */
        CancelationReason["UNKNOWN"] = "Unknown";
    })(CancelationReason = CdvPurchase.CancelationReason || (CdvPurchase.CancelationReason = {}));
})(CdvPurchase || (CdvPurchase = {}));
/// <reference path="../../types.ts" />
/// <reference path="../../product.ts" />
/// <reference path="../../receipt.ts" />
/// <reference path="../../offer.ts" />
/// <reference path="../../transaction.ts" />
var CdvPurchase;
(function (CdvPurchase) {
    // Apple
    let AppleAppStore;
    (function (AppleAppStore) {
        class SKReceipt extends CdvPurchase.Receipt {
        }
        AppleAppStore.SKReceipt = SKReceipt;
        class SKProduct extends CdvPurchase.Product {
        }
        AppleAppStore.SKProduct = SKProduct;
        class SKOffer extends CdvPurchase.Offer {
        }
        AppleAppStore.SKOffer = SKOffer;
        class SKTransaction extends CdvPurchase.Transaction {
        }
        AppleAppStore.SKTransaction = SKTransaction;
        class Adapter {
            constructor(context) {
                this.id = CdvPurchase.Platform.APPLE_APPSTORE;
                this.name = 'AppStore';
                this.products = [];
                this.receipts = [];
            }
            initialize() {
                return __awaiter(this, void 0, void 0, function* () { return; });
            }
            load(products) {
                return __awaiter(this, void 0, void 0, function* () {
                    return products.map(p => ({ code: CdvPurchase.ErrorCode.LOAD, message: 'Not implemented' }));
                });
            }
            order(offer) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'TODO: Not implemented'
                    };
                });
            }
            finish(transaction) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'TODO: Not implemented'
                    };
                });
            }
            receiptValidationBody(receipt) {
                // TODO
                return;
            }
            handleReceiptValidationResponse(receipt, response) {
                return __awaiter(this, void 0, void 0, function* () {
                    return;
                });
            }
            requestPayment(payment, additionalData) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'requestPayment not supported',
                    };
                });
            }
        }
        AppleAppStore.Adapter = Adapter;
    })(AppleAppStore = CdvPurchase.AppleAppStore || (CdvPurchase.AppleAppStore = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let AppleAppStore;
    (function (AppleAppStore) {
        let VerifyReceipt;
        (function (VerifyReceipt) {
            /** The reason a subscription expired.
             * https://developer.apple.com/documentation/appstorereceipts/expiration_intent
             */
            let AppleExpirationIntent;
            (function (AppleExpirationIntent) {
                /** The customer voluntarily canceled their subscription. */
                AppleExpirationIntent["CANCELED"] = "1";
                /** Billing error; for example, the customer"s payment information was no longer valid. */
                AppleExpirationIntent["BILLING_ERROR"] = "2";
                /** The customer did not agree to a recent price increase. */
                AppleExpirationIntent["PRICE_INCREASE"] = "3";
                /** The product was not available for purchase at the time of renewal. */
                AppleExpirationIntent["PRODUCT_NOT_AVAILABLE"] = "4";
                /** Unknown error. */
                AppleExpirationIntent["UNKNOWN"] = "5";
            })(AppleExpirationIntent = VerifyReceipt.AppleExpirationIntent || (VerifyReceipt.AppleExpirationIntent = {}));
        })(VerifyReceipt = AppleAppStore.VerifyReceipt || (AppleAppStore.VerifyReceipt = {}));
    })(AppleAppStore = CdvPurchase.AppleAppStore || (CdvPurchase.AppleAppStore = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Braintree;
    (function (Braintree) {
        // export type NonceProvider = (type: PaymentMethod, callback: Callback<Nonce | IError>) => void;
        let PaymentMethod;
        (function (PaymentMethod) {
            PaymentMethod["THREE_D_SECURE"] = "THREE_D_SECURE";
        })(PaymentMethod = Braintree.PaymentMethod || (Braintree.PaymentMethod = {}));
        class BraintreeReceipt extends CdvPurchase.Receipt {
            constructor(paymentRequest, dropInResult) {
                // Now we have to send this to the server + the request
                // result.paymentDescription; // "1111"
                // result.paymentMethodType; // "VISA"
                // result.deviceData; // undefined
                // result.paymentMethodNonce; // {"isDefault":false,"nonce":"tokencc_bh_rdjmsc_76vjtq_9tzsv3_4467mg_tt4"}
                var _a, _b;
                const transaction = new CdvPurchase.Transaction(CdvPurchase.Platform.BRAINTREE);
                transaction.products = paymentRequest.productIds.map(productId => ({ productId }));
                transaction.state = CdvPurchase.TransactionState.APPROVED;
                transaction.transactionId = (_b = (_a = dropInResult.paymentMethodNonce) === null || _a === void 0 ? void 0 : _a.nonce) !== null && _b !== void 0 ? _b : `UNKNOWN_${dropInResult.paymentMethodType}_${dropInResult.paymentDescription}`;
                super({
                    platform: CdvPurchase.Platform.BRAINTREE,
                    transactions: [transaction],
                });
                this.dropInResult = dropInResult;
                this.paymentRequest = paymentRequest;
                this.refresh(paymentRequest, dropInResult);
            }
            refresh(paymentRequest, dropInResult) {
                var _a, _b;
                this.dropInResult = dropInResult;
                this.paymentRequest = paymentRequest;
                const transaction = new CdvPurchase.Transaction(CdvPurchase.Platform.BRAINTREE);
                transaction.products = paymentRequest.productIds.map(productId => ({ productId }));
                transaction.state = CdvPurchase.TransactionState.APPROVED;
                transaction.transactionId = (_b = (_a = dropInResult.paymentMethodNonce) === null || _a === void 0 ? void 0 : _a.nonce) !== null && _b !== void 0 ? _b : `UNKNOWN_${dropInResult.paymentMethodType}_${dropInResult.paymentDescription}`;
            }
        }
        Braintree.BraintreeReceipt = BraintreeReceipt;
        class Adapter {
            constructor(context, options) {
                this.id = CdvPurchase.Platform.BRAINTREE;
                this.name = 'BrainTree';
                this.products = [];
                this._receipts = [];
                this.context = context;
                this.log = context.log.child("Braintree");
                this.options = options;
            }
            get receipts() { return this._receipts; }
            /**
             * Initialize the Braintree Adapter.
             */
            initialize() {
                return new Promise(resolve => {
                    this.log.info("initialize()");
                    if (Braintree.AndroidBridge.Bridge.isSupported() && !this.androidBridge) {
                        this.log.info("instantiating android bridge...");
                        this.androidBridge = new Braintree.AndroidBridge.Bridge(this.log);
                        this.log.info("calling android bridge -> initialize...");
                        const auth = this.options.tokenizationKey
                            ? this.options.tokenizationKey
                            : this.options.clientTokenProvider
                                ? this.options.clientTokenProvider
                                : '';
                        this.androidBridge.initialize(auth, resolve);
                    }
                    else {
                        this.log.info("platform not supported...");
                        resolve(undefined);
                    }
                });
            }
            load(products) {
                return __awaiter(this, void 0, void 0, function* () {
                    return products.map(p => ({ code: CdvPurchase.ErrorCode.PRODUCT_NOT_AVAILABLE, message: 'TODO' }));
                });
            }
            order(offer) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'TODO: Not implemented'
                    };
                });
            }
            finish(transaction) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'TODO: Not implemented'
                    };
                });
            }
            // async getNonce(paymentMethod: PaymentMethod): Promise<Nonce | IError> {
            //     return new Promise(resolve => {
            //         if (this.options.nonceProvider) {
            //             this.options.nonceProvider(paymentMethod, resolve);
            //         }
            //         else {
            //             resolve({
            //                 code: ErrorCode.UNAUTHORIZED_REQUEST_DATA,
            //                 message: 'Braintree requires a nonceProvider',
            //             });
            //         }
            //     });
            // }
            requestPayment(paymentRequest, additionalData) {
                var _a, _b, _c, _d;
                return __awaiter(this, void 0, void 0, function* () {
                    this.log.info("requestPayment()" + JSON.stringify(paymentRequest));
                    let dropInResult;
                    if ((_a = additionalData === null || additionalData === void 0 ? void 0 : additionalData.braintree) === null || _a === void 0 ? void 0 : _a.dropInRequest) {
                        // User provided a full DropInRequest, just passing it through
                        const response = yield ((_b = this.androidBridge) === null || _b === void 0 ? void 0 : _b.launchDropIn(additionalData.braintree.dropInRequest));
                        if (!response || (('code' in response) && ('message' in response))) {
                            return response;
                        }
                        dropInResult = response;
                    }
                    /*
                    else if (!additionalData?.braintree?.method || additionalData.braintree.method === PaymentMethod.THREE_D_SECURE) {
                        // User requested a 3D Secure payment
                        const nonce = await this.getNonce(PaymentMethod.THREE_D_SECURE);
                        if ('code' in nonce) {
                            return nonce;
                        }
                        if (nonce.type !== PaymentMethod.THREE_D_SECURE) {
                            return {
                                code: ErrorCode.BAD_RESPONSE,
                                message: 'The returned nonce should be of type THREE_D_SECURE',
                            };
                        }
                        const threeDSecureRequest: CdvPurchase.Braintree.ThreeDSecure.Request = {
                            amount: formatAmount(payment.amountMicros),
                            nonce: nonce.value,
                            email: payment.email,
                            mobilePhoneNumber: payment.mobilePhoneNumber,
                            billingAddress: {
                                givenName: payment.billingAddress?.givenName,
                                surname: payment.billingAddress?.surname,
                                streetAddress: payment.billingAddress?.streetAddress1,
                                extendedAddress: payment.billingAddress?.streetAddress2,
                                line3: payment.billingAddress?.streetAddress3,
                                locality: payment.billingAddress?.locality,
                                phoneNumber: payment.billingAddress?.phoneNumber,
                                postalCode: payment.billingAddress?.postalCode,
                                region: payment.billingAddress?.region,
                                countryCodeAlpha2: payment.billingAddress?.countryCode,
                            },
                        }
                        const result = await this.androidBridge?.launchDropIn({ threeDSecureRequest });
                        if (result?.code) {
                            this.log.warn("launchDropIn failed: " + JSON.stringify(result));
                            return result;
                        }
                    }
                    */
                    else {
                        // No other payment method as the moment...
                        const response = yield ((_c = this.androidBridge) === null || _c === void 0 ? void 0 : _c.launchDropIn({}));
                        if (!response || (('code' in response) && ('message' in response))) {
                            // Failed
                            this.log.warn("launchDropIn failed: " + JSON.stringify(response));
                            return response;
                        }
                        // Success
                        dropInResult = response;
                    }
                    this.log.info("launchDropIn success: " + JSON.stringify({ paymentRequest, dropInResult }));
                    if (!((_d = dropInResult.paymentMethodNonce) === null || _d === void 0 ? void 0 : _d.nonce)) {
                        return {
                            code: CdvPurchase.ErrorCode.BAD_RESPONSE,
                            message: 'launchDropIn returned no paymentMethodNonce',
                        };
                    }
                    let receipt = this._receipts.find(r => { var _a, _b; return ((_a = r.dropInResult.paymentMethodNonce) === null || _a === void 0 ? void 0 : _a.nonce) === ((_b = dropInResult.paymentMethodNonce) === null || _b === void 0 ? void 0 : _b.nonce); });
                    if (receipt) {
                        receipt.refresh(paymentRequest, dropInResult);
                    }
                    else {
                        receipt = new BraintreeReceipt(paymentRequest, dropInResult);
                        this.receipts.push(receipt);
                    }
                    this.context.listener.receiptsUpdated(CdvPurchase.Platform.BRAINTREE, [receipt]);
                });
            }
            receiptValidationBody(receipt) {
                var _a, _b, _c, _d;
                if (!isBraintreeReceipt(receipt)) {
                    this.log.error("Unexpected error, expecting a BraintreeReceipt: " + JSON.stringify(receipt));
                    return;
                }
                this.log.info("create receiptValidationBody for: " + JSON.stringify(receipt));
                return {
                    id: (_b = (_a = receipt.paymentRequest.productIds) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : 'unknown',
                    type: CdvPurchase.ProductType.CONSUMABLE,
                    priceMicros: receipt.paymentRequest.amountMicros,
                    currency: receipt.paymentRequest.currency,
                    transaction: {
                        type: CdvPurchase.Platform.BRAINTREE,
                        deviceData: receipt.dropInResult.deviceData,
                        id: 'nonce',
                        paymentMethodNonce: (_d = (_c = receipt.dropInResult.paymentMethodNonce) === null || _c === void 0 ? void 0 : _c.nonce) !== null && _d !== void 0 ? _d : '',
                        paymentDescription: receipt.dropInResult.paymentDescription,
                        paymentMethodType: receipt.dropInResult.paymentMethodType,
                    }
                };
            }
            handleReceiptValidationResponse(receipt, response) {
                return __awaiter(this, void 0, void 0, function* () {
                    this.log.info("receipt validation response: " + JSON.stringify(response));
                    // return;
                });
            }
        }
        Braintree.Adapter = Adapter;
        function formatAmount(amountMicros) {
            const amountCents = '' + (amountMicros / 10000);
            return (amountCents.slice(0, -2) || '0') + '.' + (amountCents.slice(-2, -1) || '0') + (amountCents.slice(-1) || '0');
        }
        function isBraintreeReceipt(receipt) {
            return receipt.platform === CdvPurchase.Platform.BRAINTREE;
        }
    })(Braintree = CdvPurchase.Braintree || (CdvPurchase.Braintree = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Braintree;
    (function (Braintree) {
        /**
         * Cordova plugin ID for the braintree plugin.
         */
        const PLUGIN_ID = 'BraintreePlugin';
        let AndroidBridge;
        (function (AndroidBridge) {
            /**
             * Bridge to access native functions.
             *
             * This tries to export pretty raw functions from the underlying native SDKs.
             */
            class Bridge {
                constructor(log) {
                    this.log = log.child("AndroidBridge");
                }
                /** Receive asynchronous messages from the native side */
                listener(msg) {
                    // Handle changes to purchase that are being notified
                    // through the PurchasesUpdatedListener on the native side (android)
                    this.log.debug('listener: ' + JSON.stringify(msg));
                    if (!msg || !msg.type) {
                        return;
                    }
                    if (msg.type === "getClientToken") {
                        this.getClientToken();
                    }
                    else if (msg.type === "ready") {
                    }
                }
                // Braintree reported an error
                // private onError(message: string) {
                //     this.log.warn("Braintree reported an error: " + message);
                //     // TODO - bubble that up to the client
                // }
                /*
                 * Initialize the braintree client.
                 *
                 * @param clientTokenProvider Provide clientTokens to the SDK when it needs them.
                 */
                initialize(clientTokenProvider, callback) {
                    try {
                        // Set a listener (see "listener()" function above)
                        if (typeof clientTokenProvider === 'string') {
                            const token = clientTokenProvider;
                            this.clientTokenProvider = (callback) => { callback(token); };
                        }
                        else {
                            this.clientTokenProvider = clientTokenProvider;
                        }
                        this.log.info("exec.setListener()");
                        const listener = this.listener.bind(this);
                        window.cordova.exec(listener, null, PLUGIN_ID, "setListener", []);
                        callback(undefined);
                    }
                    catch (err) {
                        this.log.warn("initialization failed: " + (err === null || err === void 0 ? void 0 : err.message));
                        callback({
                            code: CdvPurchase.ErrorCode.SETUP,
                            message: 'Failed to initialize Braintree Android Bridge: ' + (err === null || err === void 0 ? void 0 : err.message),
                        });
                    }
                }
                /**
                 * Fetches a client token and sends it to the SDK.
                 *
                 * This method is called by the native side when the SDK requests a Client Token.
                 */
                getClientToken() {
                    this.log.info("getClientToken()");
                    if (this.clientTokenProvider) {
                        this.log.debug("clientTokenProvider set, calling.");
                        this.clientTokenProvider((value) => {
                            if (typeof value === 'string') {
                                window.cordova.exec(null, null, PLUGIN_ID, "onClientTokenSuccess", [value]);
                            }
                            else {
                                window.cordova.exec(null, null, PLUGIN_ID, "onClientTokenFailure", [value.code, value.message]);
                            }
                        });
                    }
                    else {
                        this.log.debug("clientTokenProvider not set, retrying later...");
                        setTimeout(() => this.getClientToken(), 1000); // retry after 1s (over and over)
                    }
                }
                /** Returns true on Android, the only platform supported by this Braintree bridge */
                static isSupported() {
                    return window.cordova.platformId === 'android';
                }
                launchDropIn(dropInRequest) {
                    return new Promise(resolve => {
                        window.cordova.exec((result) => {
                            this.log.info("dropInSuccess: " + JSON.stringify(result));
                            resolve(result);
                        }, (err) => {
                            this.log.info("dropIFailure: " + err);
                            const errCode = err.split("|")[0];
                            const errMessage = err.split("|").slice(1).join('');
                            if (errCode === "UserCanceledException") {
                                resolve({
                                    code: CdvPurchase.ErrorCode.PAYMENT_CANCELLED,
                                    message: errMessage,
                                });
                            }
                            else if (errCode === "AuthorizationException") {
                                resolve({
                                    code: CdvPurchase.ErrorCode.UNAUTHORIZED_REQUEST_DATA,
                                    message: errMessage,
                                });
                            }
                            else {
                                resolve({
                                    code: CdvPurchase.ErrorCode.UNKNOWN,
                                    message: err,
                                });
                            }
                        }, PLUGIN_ID, "launchDropIn", [dropInRequest]);
                    });
                }
            }
            AndroidBridge.Bridge = Bridge;
        })(AndroidBridge = Braintree.AndroidBridge || (Braintree.AndroidBridge = {}));
    })(Braintree = CdvPurchase.Braintree || (CdvPurchase.Braintree = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Braintree;
    (function (Braintree) {
        let DropIn;
        (function (DropIn) {
            /** How a field will behave in CardForm. */
            let CardFormFieldStatus;
            (function (CardFormFieldStatus) {
                CardFormFieldStatus[CardFormFieldStatus["DISABLED"] = 0] = "DISABLED";
                CardFormFieldStatus[CardFormFieldStatus["OPTIONAL"] = 1] = "OPTIONAL";
                CardFormFieldStatus[CardFormFieldStatus["REQUIRED"] = 2] = "REQUIRED";
            })(CardFormFieldStatus = DropIn.CardFormFieldStatus || (DropIn.CardFormFieldStatus = {}));
        })(DropIn = Braintree.DropIn || (Braintree.DropIn = {}));
    })(Braintree = CdvPurchase.Braintree || (CdvPurchase.Braintree = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Braintree;
    (function (Braintree) {
        let DropIn;
        (function (DropIn) {
            let PaymentMethod;
            (function (PaymentMethod) {
                PaymentMethod["AMEX"] = "AMEX";
                PaymentMethod["GOOGLE_PAY"] = "GOOGLE_PAY";
                PaymentMethod["DINERS_CLUB"] = "DINERS_CLUB";
                PaymentMethod["DISCOVER"] = "DISCOVER";
                PaymentMethod["JCB"] = "JCB";
                PaymentMethod["MAESTRO"] = "MAESTRO";
                PaymentMethod["MASTERCARD"] = "MASTERCARD";
                PaymentMethod["PAYPAL"] = "PAYPAL";
                PaymentMethod["VISA"] = "VISA";
                PaymentMethod["VENMO"] = "VENMO";
                PaymentMethod["UNIONPAY"] = "UNIONPAY";
                PaymentMethod["HIPER"] = "HIPER";
                PaymentMethod["HIPERCARD"] = "HIPERCARD";
                PaymentMethod["UNKNOWN"] = "UNKNOWN";
            })(PaymentMethod = DropIn.PaymentMethod || (DropIn.PaymentMethod = {}));
        })(DropIn = Braintree.DropIn || (Braintree.DropIn = {}));
    })(Braintree = CdvPurchase.Braintree || (CdvPurchase.Braintree = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Braintree;
    (function (Braintree) {
        let ThreeDSecure;
        (function (ThreeDSecure) {
            /** The account type */
            let AccountType;
            (function (AccountType) {
                AccountType["UNSPECIFIED"] = "00";
                AccountType["CREDIT"] = "01";
                AccountType["DEBIT"] = "02";
            })(AccountType = ThreeDSecure.AccountType || (ThreeDSecure.AccountType = {}));
            /** The shipping method */
            let ShippingMethod;
            (function (ShippingMethod) {
                /** Unspecified */
                ShippingMethod[ShippingMethod["UNSPECIFIED"] = 0] = "UNSPECIFIED";
                /** Same say */
                ShippingMethod[ShippingMethod["SAME_DAY"] = 1] = "SAME_DAY";
                /** Overnight / Expedited */
                ShippingMethod[ShippingMethod["EXPEDITED"] = 2] = "EXPEDITED";
                /** Priority */
                ShippingMethod[ShippingMethod["PRIORITY"] = 3] = "PRIORITY";
                /** Ground */
                ShippingMethod[ShippingMethod["GROUND"] = 4] = "GROUND";
                /** Electronic delivery */
                ShippingMethod[ShippingMethod["ELECTRONIC_DELIVERY"] = 5] = "ELECTRONIC_DELIVERY";
                /** Ship to store */
                ShippingMethod[ShippingMethod["SHIP_TO_STORE"] = 6] = "SHIP_TO_STORE";
            })(ShippingMethod = ThreeDSecure.ShippingMethod || (ThreeDSecure.ShippingMethod = {}));
            let Version;
            (function (Version) {
                /** 3DS 1.0 */
                Version[Version["V1"] = 0] = "V1";
                /** 3DS 2.0 */
                Version[Version["V2"] = 1] = "V2";
            })(Version = ThreeDSecure.Version || (ThreeDSecure.Version = {}));
        })(ThreeDSecure = Braintree.ThreeDSecure || (Braintree.ThreeDSecure = {}));
    })(Braintree = CdvPurchase.Braintree || (CdvPurchase.Braintree = {}));
})(CdvPurchase || (CdvPurchase = {}));
/// <reference path="../../receipt.ts" />
/// <reference path="../../transaction.ts" />
var CdvPurchase;
(function (CdvPurchase) {
    let GooglePlay;
    (function (GooglePlay) {
        class Transaction extends CdvPurchase.Transaction {
            constructor(purchase) {
                super(CdvPurchase.Platform.GOOGLE_PLAY);
                this.nativePurchase = purchase;
                this.refresh(purchase);
            }
            static toState(state, isAcknowledged) {
                switch (state) {
                    case GooglePlay.Bridge.PurchaseState.PENDING:
                        return CdvPurchase.TransactionState.INITIATED;
                    case GooglePlay.Bridge.PurchaseState.PURCHASED:
                        // if (isAcknowledged)
                        // return TransactionState.FINISHED; (this prevents receipt validation...)
                        // else
                        return CdvPurchase.TransactionState.APPROVED;
                    case GooglePlay.Bridge.PurchaseState.UNSPECIFIED_STATE:
                        return CdvPurchase.TransactionState.UNKNOWN_STATE;
                }
            }
            /**
             * Refresh the value in the transaction based on the native purchase update
             */
            refresh(purchase) {
                this.nativePurchase = purchase;
                this.transactionId = `${purchase.orderId || purchase.purchaseToken}`;
                this.purchaseId = `${purchase.purchaseToken}`;
                this.products = purchase.productIds.map(productId => ({ productId }));
                if (purchase.purchaseTime)
                    this.purchaseDate = new Date(purchase.purchaseTime);
                this.isPending = (purchase.getPurchaseState === GooglePlay.Bridge.PurchaseState.PENDING);
                if (typeof purchase.acknowledged !== 'undefined')
                    this.isAcknowledged = purchase.acknowledged;
                if (typeof purchase.autoRenewing !== 'undefined')
                    this.renewalIntent = purchase.autoRenewing ? CdvPurchase.RenewalIntent.RENEW : CdvPurchase.RenewalIntent.LAPSE;
                this.state = Transaction.toState(purchase.getPurchaseState, purchase.acknowledged);
            }
        }
        GooglePlay.Transaction = Transaction;
        class Receipt extends CdvPurchase.Receipt {
            constructor(purchase) {
                super({
                    platform: CdvPurchase.Platform.GOOGLE_PLAY,
                    transactions: [new Transaction(purchase)],
                });
                this.purchaseToken = purchase.purchaseToken;
                this.orderId = purchase.orderId;
            }
            /** Refresh the content of the purchase based on the native BridgePurchase */
            refresh(purchase) {
                var _a;
                (_a = this.transactions[0]) === null || _a === void 0 ? void 0 : _a.refresh(purchase);
                this.orderId = purchase.orderId;
            }
        }
        GooglePlay.Receipt = Receipt;
        class Adapter {
            constructor(context, autoRefreshIntervalMillis = 1000 * 3600 * 24) {
                /** Adapter identifier */
                this.id = CdvPurchase.Platform.GOOGLE_PLAY;
                /** Adapter name */
                this.name = 'GooglePlay';
                this._products = new GooglePlay.Products();
                this._receipts = [];
                /** The GooglePlay bridge */
                this.bridge = new GooglePlay.Bridge.Bridge();
                /** Prevent double initialization */
                this.initialized = false;
                /** Used to retry failed commands */
                this.retry = new CdvPurchase.Retry();
                this.autoRefreshIntervalMillis = 0;
                if (Adapter._instance)
                    throw new Error('GooglePlay adapter already initialized');
                this.autoRefreshIntervalMillis = autoRefreshIntervalMillis;
                this.context = context;
                this.log = context.log.child('GooglePlay');
                Adapter._instance = this;
            }
            /** List of products managed by the GooglePlay adapter */
            get products() { return this._products.products; }
            get receipts() { return this._receipts; }
            initialize() {
                return __awaiter(this, void 0, void 0, function* () {
                    this.log.info("Initialize");
                    if (this.initializationPromise)
                        return this.initializationPromise;
                    return this.initializationPromise = new Promise((resolve) => {
                        const bridgeLogger = this.log.child('Bridge');
                        const iabOptions = {
                            onSetPurchases: this.onSetPurchases.bind(this),
                            onPurchasesUpdated: this.onPurchasesUpdated.bind(this),
                            onPurchaseConsumed: this.onPurchaseConsumed.bind(this),
                            showLog: this.context.verbosity >= CdvPurchase.LogLevel.DEBUG ? true : false,
                            log: (msg) => bridgeLogger.info(msg),
                        };
                        const iabReady = () => {
                            this.log.debug("Ready");
                            // Auto-refresh every 24 hours (or autoRefreshIntervalMillis)
                            if (this.autoRefreshIntervalMillis > 0) {
                                window.setInterval(() => this.getPurchases(), this.autoRefreshIntervalMillis);
                            }
                            resolve(undefined);
                        };
                        const iabError = (err) => {
                            this.initialized = false;
                            this.context.error({
                                code: CdvPurchase.ErrorCode.SETUP,
                                message: "Init failed - " + err
                            });
                            this.retry.retry(() => this.initialize());
                        };
                        this.bridge.init(iabReady, iabError, iabOptions);
                    });
                });
            }
            /** Prepare the list of SKUs sorted by type */
            getSkusOf(products) {
                const inAppSkus = [];
                const subsSkus = [];
                for (const product of products) {
                    if (product.type === CdvPurchase.ProductType.PAID_SUBSCRIPTION)
                        subsSkus.push(product.id);
                    else
                        inAppSkus.push(product.id);
                }
                return { inAppSkus, subsSkus };
            }
            /** @inheritDoc */
            load(products) {
                return new Promise((resolve) => {
                    this.log.debug("Load: " + JSON.stringify(products));
                    /** Called when a list of product definitions have been loaded */
                    const iabLoaded = (validProducts) => {
                        this.log.debug("Loaded: " + JSON.stringify(validProducts));
                        const ret = products.map(registeredProduct => {
                            const validProduct = validProducts.find(vp => vp.productId === registeredProduct.id);
                            if (validProduct && validProduct.productId) {
                                return this._products.addProduct(registeredProduct, validProduct);
                            }
                            else {
                                return {
                                    code: CdvPurchase.ErrorCode.INVALID_PRODUCT_ID,
                                    message: `Product with id ${registeredProduct.id} not found.`,
                                };
                            }
                        });
                        resolve(ret);
                        // let's also refresh purchases
                        this.getPurchases();
                    };
                    /** Start loading products */
                    const go = () => {
                        const { inAppSkus, subsSkus } = this.getSkusOf(products);
                        this.log.debug("getAvailableProducts: " + JSON.stringify(inAppSkus) + " | " + JSON.stringify(subsSkus));
                        this.bridge.getAvailableProducts(inAppSkus, subsSkus, iabLoaded, (err) => {
                            // failed to load products, retry later.
                            this.retry.retry(go);
                            this.context.error({
                                code: CdvPurchase.ErrorCode.LOAD,
                                message: 'Loading product info failed - ' + err + ' - retrying later...'
                            });
                        });
                    };
                    go();
                });
            }
            /** @inheritDoc */
            finish(transaction) {
                return new Promise(resolve => {
                    const onSuccess = () => resolve(undefined);
                    const onFailure = (message, code) => resolve({ message, code });
                    const firstProduct = transaction.products[0];
                    if (!firstProduct)
                        return resolve({ code: CdvPurchase.ErrorCode.FINISH, message: 'Cannot finish a transaction with no product' });
                    const product = this._products.getProduct(firstProduct.productId);
                    if (!product)
                        return resolve({ code: CdvPurchase.ErrorCode.FINISH, message: 'Cannot finish transaction, unknown product ' + firstProduct.productId });
                    const receipt = this._receipts.find(r => r.hasTransaction(transaction));
                    if (!receipt)
                        return resolve({ code: CdvPurchase.ErrorCode.FINISH, message: 'Cannot finish transaction, linked receipt not found.' });
                    if (!receipt.purchaseToken)
                        return resolve({ code: CdvPurchase.ErrorCode.FINISH, message: 'Cannot finish transaction, linked receipt contains no purchaseToken.' });
                    if (product.type === CdvPurchase.ProductType.NON_RENEWING_SUBSCRIPTION || product.type === CdvPurchase.ProductType.CONSUMABLE) {
                        if (!transaction.isConsumed)
                            return this.bridge.consumePurchase(onSuccess, onFailure, receipt.purchaseToken);
                    }
                    else { // subscription and non-consumable
                        if (!transaction.isAcknowledged)
                            return this.bridge.acknowledgePurchase(onSuccess, onFailure, receipt.purchaseToken);
                    }
                    // nothing to do
                    resolve(undefined);
                });
            }
            onPurchaseConsumed(purchase) {
                this.log.debug("onPurchaseConsumed: " + purchase.orderId);
            }
            /** Called when the platform reports update for some purchases */
            onPurchasesUpdated(purchases) {
                this.log.debug("onPurchaseUpdated: " + purchases.map(p => p.orderId).join(', '));
                // GooglePlay generates one receipt for each purchase
                purchases.forEach(purchase => {
                    const existingReceipt = this.receipts.find(r => r.purchaseToken === purchase.purchaseToken);
                    if (existingReceipt) {
                        existingReceipt.refresh(purchase);
                        this.context.listener.receiptsUpdated(CdvPurchase.Platform.GOOGLE_PLAY, [existingReceipt]);
                    }
                    else {
                        const newReceipt = new Receipt(purchase);
                        this.receipts.push(newReceipt);
                        this.context.listener.receiptsUpdated(CdvPurchase.Platform.GOOGLE_PLAY, [newReceipt]);
                    }
                });
            }
            /** Called when the platform reports some purchases */
            onSetPurchases(purchases) {
                this.log.debug("onSetPurchases: " + JSON.stringify(purchases));
                this.onPurchasesUpdated(purchases);
            }
            onPriceChangeConfirmationResult(result) {
            }
            /** Refresh purchases from GooglePlay */
            getPurchases() {
                return new Promise(resolve => {
                    this.log.debug('getPurchases');
                    const success = () => {
                        this.log.debug('getPurchases success');
                        setTimeout(() => resolve(undefined), 0);
                    };
                    const failure = (message, code) => {
                        this.log.warn('getPurchases failed: ' + message + ' (' + code + ')');
                        setTimeout(() => resolve({ code: code || CdvPurchase.ErrorCode.UNKNOWN, message }), 0);
                    };
                    this.bridge.getPurchases(success, failure);
                });
            }
            /** @inheritDoc */
            order(offer, additionalData) {
                return __awaiter(this, void 0, void 0, function* () {
                    return new Promise(resolve => {
                        this.log.info("Order - " + JSON.stringify(offer));
                        const buySuccess = () => resolve(undefined);
                        const buyFailed = (message, code) => {
                            this.log.warn('Order failed: ' + JSON.stringify({ message, code }));
                            resolve({ code: code !== null && code !== void 0 ? code : CdvPurchase.ErrorCode.UNKNOWN, message });
                        };
                        if (offer.product.type === CdvPurchase.ProductType.PAID_SUBSCRIPTION) {
                            const idAndToken = offer.id; // offerId contains the productId and token (format productId@offerToken)
                            this.bridge.subscribe(buySuccess, buyFailed, idAndToken, additionalData);
                        }
                        else {
                            this.bridge.buy(buySuccess, buyFailed, offer.product.id, additionalData);
                        }
                    });
                });
            }
            /**
             * Prepare for receipt validation
             */
            receiptValidationBody(receipt) {
                var _a;
                const transaction = receipt.transactions[0];
                if (!transaction)
                    return;
                const productId = (_a = transaction.products[0]) === null || _a === void 0 ? void 0 : _a.productId;
                if (!productId)
                    return;
                const product = this._products.getProduct(productId);
                if (!product)
                    return;
                const purchase = transaction.nativePurchase;
                return {
                    id: productId,
                    type: product.type,
                    offers: product.offers,
                    transaction: {
                        type: CdvPurchase.Platform.GOOGLE_PLAY,
                        id: receipt.transactions[0].transactionId,
                        purchaseToken: purchase.purchaseToken,
                        signature: purchase.signature,
                        receipt: purchase.receipt,
                    }
                };
            }
            handleReceiptValidationResponse(receipt, response) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (response.ok) {
                        const transaction = response.data.transaction;
                        if (transaction.type !== CdvPurchase.Platform.GOOGLE_PLAY)
                            return;
                        switch (transaction.kind) {
                            case 'androidpublisher#productPurchase':
                                break;
                            case 'androidpublisher#subscriptionPurchase':
                                break;
                            case 'androidpublisher#subscriptionPurchaseV2':
                                transaction;
                                break;
                            case 'fovea#subscriptionGone':
                                // the transaction doesn't exist anymore
                                break;
                        }
                    }
                    return; // Nothing specific to do on GooglePlay
                });
            }
            requestPayment(payment, additionalData) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'requestPayment not supported',
                    };
                });
            }
        }
        GooglePlay.Adapter = Adapter;
    })(GooglePlay = CdvPurchase.GooglePlay || (CdvPurchase.GooglePlay = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let GooglePlay;
    (function (GooglePlay) {
        let Bridge;
        (function (Bridge) {
            /* export namespace V11 {
                export interface Subscription {
                    product_format: "v11.0";
                    productId: string;
                    title: string;
                    name: string;
                    billing_period: string;
                    billing_period_unit: string;
                    description: string;
                    price: string;
                    price_amount_micros: string;
                    price_currency_code: string;
                    trial_period: string;
                    trial_period_unit: string;
                    formatted_price: string;
                    freeTrialPeriod: string;
                    introductoryPrice: string;
                    introductoryPriceAmountMicros: string;
                    introductoryPriceCycles: string;
                    introductoryPricePeriod: string;
                    subscriptionPeriod: string;
                }
            } */
            let RecurrenceMode;
            (function (RecurrenceMode) {
                RecurrenceMode["FINITE_RECURRING"] = "FINITE_RECURRING";
                RecurrenceMode["INFINITE_RECURRING"] = "INFINITE_RECURRING";
                RecurrenceMode["NON_RECURRING"] = "NON_RECURRING";
            })(RecurrenceMode = Bridge.RecurrenceMode || (Bridge.RecurrenceMode = {}));
        })(Bridge = GooglePlay.Bridge || (GooglePlay.Bridge = {}));
    })(GooglePlay = CdvPurchase.GooglePlay || (CdvPurchase.GooglePlay = {}));
})(CdvPurchase || (CdvPurchase = {}));
/*
 * Copyright (C) 2012-2013 by Guillaume Charhon
 * Modifications 10/16/2013 by Brian Thurlow
 */
/*global cordova */
var CdvPurchase;
(function (CdvPurchase) {
    let GooglePlay;
    (function (GooglePlay) {
        /** Replace SKU ProrationMode.
         *
         * See https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProrationMode */
        let ProrationMode;
        (function (ProrationMode) {
            /** Replacement takes effect immediately, and the remaining time will be prorated and credited to the user. */
            ProrationMode["IMMEDIATE_WITH_TIME_PRORATION"] = "IMMEDIATE_WITH_TIME_PRORATION";
            /** Replacement takes effect immediately, and the billing cycle remains the same. */
            ProrationMode["IMMEDIATE_AND_CHARGE_PRORATED_PRICE"] = "IMMEDIATE_AND_CHARGE_PRORATED_PRICE";
            /** Replacement takes effect immediately, and the new price will be charged on next recurrence time. */
            ProrationMode["IMMEDIATE_WITHOUT_PRORATION"] = "IMMEDIATE_WITHOUT_PRORATION";
            /** Replacement takes effect when the old plan expires, and the new price will be charged at the same time. */
            ProrationMode["DEFERRED"] = "DEFERRED";
            /** Replacement takes effect immediately, and the user is charged full price of new plan and is given a full billing cycle of subscription, plus remaining prorated time from the old plan. */
            ProrationMode["IMMEDIATE_AND_CHARGE_FULL_PRICE"] = "IMMEDIATE_AND_CHARGE_FULL_PRICE";
        })(ProrationMode = GooglePlay.ProrationMode || (GooglePlay.ProrationMode = {}));
        let Bridge;
        (function (Bridge_1) {
            let log = function log(msg) {
                console.log("InAppBilling[js]: " + msg);
            };
            let PurchaseState;
            (function (PurchaseState) {
                PurchaseState[PurchaseState["UNSPECIFIED_STATE"] = 0] = "UNSPECIFIED_STATE";
                PurchaseState[PurchaseState["PURCHASED"] = 1] = "PURCHASED";
                PurchaseState[PurchaseState["PENDING"] = 2] = "PENDING";
            })(PurchaseState = Bridge_1.PurchaseState || (Bridge_1.PurchaseState = {}));
            class Bridge {
                constructor() {
                    this.options = {};
                }
                init(success, fail, options) {
                    if (!options)
                        options = {};
                    if (options.log)
                        log = options.log;
                    this.options = {
                        showLog: options.showLog !== false,
                        onPurchaseConsumed: options.onPurchaseConsumed,
                        onPurchasesUpdated: options.onPurchasesUpdated,
                        onSetPurchases: options.onSetPurchases,
                    };
                    if (this.options.showLog) {
                        log('setup ok');
                    }
                    // Set a listener (see "listener()" function above)
                    const listener = this.listener.bind(this);
                    window.cordova.exec(listener, function (err) { }, "InAppBillingPlugin", "setListener", []);
                    window.cordova.exec(success, errorCb(fail), "InAppBillingPlugin", "init", []);
                }
                load(success, fail, skus, inAppSkus, subsSkus) {
                    var hasSKUs = false;
                    // Optional Load SKUs to Inventory.
                    if (typeof skus !== "undefined") {
                        if (typeof skus === "string") {
                            skus = [skus];
                        }
                        if (skus.length > 0) {
                            if (typeof skus[0] !== 'string') {
                                var msg = 'invalid productIds: ' + JSON.stringify(skus);
                                if (this.options.showLog) {
                                    log(msg);
                                }
                                fail(msg, CdvPurchase.ErrorCode.INVALID_PRODUCT_ID);
                                return;
                            }
                            if (this.options.showLog) {
                                log('load ' + JSON.stringify(skus));
                            }
                            hasSKUs = true;
                        }
                    }
                    window.cordova.exec(success, errorCb(fail), "InAppBillingPlugin", "load", [skus, inAppSkus, subsSkus]);
                }
                listener(msg) {
                    // Handle changes to purchase that are being notified
                    // through the PurchasesUpdatedListener on the native side (android)
                    if (this.options.showLog) {
                        log('listener: ' + JSON.stringify(msg));
                    }
                    if (!msg || !msg.type) {
                        return;
                    }
                    if (msg.type === "setPurchases" && this.options.onSetPurchases) {
                        this.options.onSetPurchases(msg.data.purchases);
                    }
                    if (msg.type === "purchasesUpdated" && this.options.onPurchasesUpdated) {
                        this.options.onPurchasesUpdated(msg.data.purchases);
                    }
                    if (msg.type === "purchaseConsumed" && this.options.onPurchaseConsumed) {
                        this.options.onPurchaseConsumed(msg.data.purchase);
                    }
                    if (msg.type === "onPriceChangeConfirmationResultOK" && this.options.onPriceChangeConfirmationResult) {
                        this.options.onPriceChangeConfirmationResult("OK");
                    }
                    if (msg.type === "onPriceChangeConfirmationResultUserCanceled" && this.options.onPriceChangeConfirmationResult) {
                        this.options.onPriceChangeConfirmationResult("UserCanceled");
                    }
                    if (msg.type === "onPriceChangeConfirmationResultUnknownSku" && this.options.onPriceChangeConfirmationResult) {
                        this.options.onPriceChangeConfirmationResult("UnknownProduct");
                    }
                }
                getPurchases(success, fail) {
                    if (this.options.showLog) {
                        log('getPurchases()');
                    }
                    return window.cordova.exec(success, errorCb(fail), "InAppBillingPlugin", "getPurchases", ["null"]);
                }
                buy(success, fail, productId, additionalData) {
                    if (this.options.showLog) {
                        log('buy()');
                    }
                    return window.cordova.exec(success, errorCb(fail), "InAppBillingPlugin", "buy", [
                        productId, extendAdditionalData(additionalData)
                    ]);
                }
                subscribe(success, fail, productId, additionalData) {
                    var _a;
                    if (this.options.showLog) {
                        log('subscribe()');
                    }
                    if (((_a = additionalData.googlePlay) === null || _a === void 0 ? void 0 : _a.oldPurchaseToken) && this.options.showLog) {
                        log('subscribe() -> upgrading from an old purchase');
                    }
                    return window.cordova.exec(success, errorCb(fail), "InAppBillingPlugin", "subscribe", [
                        productId, extendAdditionalData(additionalData)
                    ]);
                }
                consumePurchase(success, fail, purchaseToken) {
                    if (this.options.showLog) {
                        log('consumePurchase()');
                    }
                    return window.cordova.exec(success, errorCb(fail), "InAppBillingPlugin", "consumePurchase", [purchaseToken]);
                }
                acknowledgePurchase(success, fail, purchaseToken) {
                    if (this.options.showLog) {
                        log('acknowledgePurchase()');
                    }
                    return window.cordova.exec(success, errorCb(fail), "InAppBillingPlugin", "acknowledgePurchase", [purchaseToken]);
                }
                getAvailableProducts(inAppSkus, subsSkus, success, fail) {
                    if (this.options.showLog) {
                        log('getAvailableProducts()');
                    }
                    return window.cordova.exec(success, errorCb(fail), "InAppBillingPlugin", "getAvailableProducts", [inAppSkus, subsSkus]);
                }
                manageSubscriptions() {
                    return window.cordova.exec(function () { }, function () { }, "InAppBillingPlugin", "manageSubscriptions", []);
                }
                manageBilling() {
                    return window.cordova.exec(function () { }, function () { }, "InAppBillingPlugin", "manageBilling", []);
                }
                launchPriceChangeConfirmationFlow(productId) {
                    return window.cordova.exec(function () { }, function () { }, "InAppBillingPlugin", "launchPriceChangeConfirmationFlow", [productId]);
                }
            }
            Bridge_1.Bridge = Bridge;
            // Generates a `fail` function that accepts an optional error code
            // in the first part of the error string.
            //
            // format: `code|message`
            //
            // `fail` function will be called with `message` as a first argument
            // and `code` as a second argument (or undefined). This ensures
            // backward compatibility with legacy code
            function errorCb(fail) {
                return function (error) {
                    if (!fail)
                        return;
                    const tokens = typeof error === 'string' ? error.split('|') : [];
                    if (tokens.length > 1 && /^[-+]?(\d+)$/.test(tokens[0])) {
                        var code = tokens[0];
                        var message = tokens[1];
                        fail(message, +code);
                    }
                    else {
                        fail(error);
                    }
                };
            }
            function ensureObject(obj) {
                return !!obj && obj.constructor === Object ? obj : {};
            }
            function extendAdditionalData(ad) {
                const additionalData = ensureObject(ad === null || ad === void 0 ? void 0 : ad.googlePlay);
                if (!additionalData.accountId && (ad === null || ad === void 0 ? void 0 : ad.applicationUsername)) {
                    additionalData.accountId = CdvPurchase.Utils.md5(ad.applicationUsername);
                }
                return additionalData;
            }
        })(Bridge = GooglePlay.Bridge || (GooglePlay.Bridge = {}));
    })(GooglePlay = CdvPurchase.GooglePlay || (CdvPurchase.GooglePlay = {}));
})(CdvPurchase || (CdvPurchase = {}));
/// <reference path="../../offer.ts" />
var CdvPurchase;
(function (CdvPurchase) {
    let GooglePlay;
    (function (GooglePlay) {
        class GProduct extends CdvPurchase.Product {
        }
        GooglePlay.GProduct = GProduct;
        class InAppOffer extends CdvPurchase.Offer {
            constructor() {
                super(...arguments);
                this.type = 'inapp';
            }
        }
        GooglePlay.InAppOffer = InAppOffer;
        class SubscriptionOffer extends CdvPurchase.Offer {
            constructor(options) {
                super(options);
                this.type = 'subs';
                this.tags = options.tags;
                this.token = options.token;
            }
        }
        GooglePlay.SubscriptionOffer = SubscriptionOffer;
        class Products {
            constructor() {
                /** List of products managed by the GooglePlay adapter */
                this.products = [];
                /** List of offers managed by the GooglePlay adapter */
                this.offers = [];
            }
            getProduct(id) {
                return this.products.find(p => p.id === id);
            }
            getOffer(id) {
                return this.offers.find(p => p.id === id);
            }
            /**  */
            addProduct(registeredProduct, vp) {
                const existingProduct = this.getProduct(registeredProduct.id);
                const p = existingProduct !== null && existingProduct !== void 0 ? existingProduct : new GProduct(registeredProduct);
                p.title = vp.title || vp.name || p.title;
                p.description = vp.description || p.description;
                // Process the product depending on the format
                if ('product_format' in vp && vp.product_format === "v12.0") {
                    if (vp.product_type === "subs")
                        this.onSubsV12Loaded(p, vp);
                    else
                        this.onInAppLoaded(p, vp);
                }
                // else if ('billing_period_unit' in vp) {
                //     return this.iabSubsV11Loaded(p, vp);
                // }
                else {
                    this.onInAppLoaded(p, vp);
                }
                if (!existingProduct) {
                    this.products.push(p);
                }
                return p;
            }
            onSubsV12Loaded(product, vp) {
                // console.log('iabSubsV12Loaded: ' + JSON.stringify(vp));
                vp.offers.forEach((productOffer) => {
                    const offer = this.iabSubsOfferV12Loaded(product, vp, productOffer);
                    product.addOffer(offer);
                });
                /*
                var firstOffer = vp.offers[0];
                if (firstOffer && firstOffer.pricing_phases.length > 0) {
                    const attributes = {
                        state: store.VALID,
                        title: vp.name,
                        description: vp.description,
                        offers: vp.offers.map(function (offer) {
                            return vp.productId + '@' + offer.token;
                        }),
                    };
                    this.iabSubsAddV12Attributes(attributes, firstOffer);
                    const p = this.getProduct(vp.productId);
                    p.set(attributes);
                    p.trigger("loaded");
                }
                */
                return product;
            }
            iabSubsOfferV12Loaded(product, vp, productOffer) {
                const offerId = vp.productId + '@' + productOffer.token;
                const existingOffer = this.getOffer(offerId);
                const pricingPhases = productOffer.pricing_phases.map(p => this.toPricingPhase(p));
                if (existingOffer) {
                    existingOffer.pricingPhases = pricingPhases;
                    return existingOffer;
                }
                else {
                    const offer = new SubscriptionOffer({ id: offerId, product, pricingPhases, token: productOffer.token, tags: productOffer.tags });
                    this.offers.push(offer);
                    return offer;
                }
                /*
                // Backward compatibility (might be incomplete if user have complex pricing models, but might as well be complete...)
                if (productOffer.pricing_phases.length > 0) {
                    iabSubsAddV12Attributes(offerAttributes, productOffer);
                }
                var offerP = store.get(offerAttributes.id);
                if (!offerP) {
                    store.register(offerAttributes);
                    offerP = store.get(offerAttributes.id);
                }
                offerP.set(offerAttributes);
                offerP.trigger("loaded");
                */
            }
            /*
            private iabSubsV11Loaded(p: Product, vp: SubscriptionV11): Product {
                // console.log('iabSubsV11Loaded: ' + JSON.stringify(vp));
                var p = store.products.byId[vp.productId];
                var attributes = {
                    state: store.VALID,
                    title: vp.name || trimTitle(vp.title),
                    description: vp.description,
                };
                var currency = vp.price_currency_code || "";
                var price = vp.formatted_price || vp.price;
                var priceMicros = vp.price_amount_micros;
                var subscriptionPeriod = vp.subscriptionPeriod ? vp.subscriptionPeriod : "";
                var introPriceSubscriptionPeriod = vp.introductoryPricePeriod ? vp.introductoryPricePeriod : "";
                var introPriceNumberOfPeriods = vp.introductoryPriceCycles ? vp.introductoryPriceCycles : 0;
                var introPricePeriodUnit = normalizeISOPeriodUnit(introPriceSubscriptionPeriod);
                var introPricePeriodCount = normalizeISOPeriodCount(introPriceSubscriptionPeriod);
                var introPricePeriod = (introPriceNumberOfPeriods || 1) * (introPricePeriodCount || 1);
                var introPriceMicros = vp.introductoryPriceAmountMicros ? vp.introductoryPriceAmountMicros : "";
                var introPrice = vp.introductoryPrice ? vp.introductoryPrice : "";
                var introPricePaymentMode;

                if (vp.freeTrialPeriod) {
                    introPricePaymentMode = 'FreeTrial';
                    try {
                        introPricePeriodUnit = normalizeISOPeriodUnit(vp.freeTrialPeriod);
                        introPricePeriodCount = normalizeISOPeriodCount(vp.freeTrialPeriod);
                        introPricePeriod = introPricePeriodCount;
                    }
                    catch (e) {
                        store.log.warn('Failed to parse free trial period: ' + vp.freeTrialPeriod);
                    }
                }
                else if (vp.introductoryPrice) {
                    if (vp.introductoryPrice < vp.price && subscriptionPeriod === introPriceSubscriptionPeriod) {
                        introPricePaymentMode = 'PayAsYouGo';
                    }
                    else if (introPriceNumberOfPeriods === 1) {
                        introPricePaymentMode = 'UpFront';
                    }
                }

                if (!introPricePaymentMode) {
                    introPricePeriod = null;
                    introPricePeriodUnit = null;
                }

                var parsedSubscriptionPeriod = {};
                if (subscriptionPeriod) {
                    parsedSubscriptionPeriod.unit = normalizeISOPeriodUnit(subscriptionPeriod);
                    parsedSubscriptionPeriod.count = normalizeISOPeriodCount(subscriptionPeriod);
                }

                var trialPeriod = vp.trial_period || null;
                var trialPeriodUnit = vp.trial_period_unit || null;
                var billingPeriod = parsedSubscriptionPeriod.count || vp.billing_period || null;
                var billingPeriodUnit = parsedSubscriptionPeriod.unit || vp.billing_period_unit || null;

                var pricingPhases = [];
                if (trialPeriod) {
                    pricingPhases.push({
                        paymentMode: 'FreeTrial',
                        recurrenceMode: store.FINITE_RECURRING,
                        period: vp.freeTrialPeriod || toISO8601Duration(trialPeriodUnit, trialPeriod),
                        cycles: 1,
                        price: null,
                        priceMicros: 0,
                        currency: currency,
                    });
                }
                else if (introPricePeriod) {
                    pricingPhases.push({
                        paymentMode: 'PayAsYouGo',
                        recurrenceMode: store.FINITE_RECURRING,
                        period: vp.introPriceSubscriptionPeriod || toISO8601Duration(introPricePeriodUnit, introPricePeriodCount),
                        cycles: vp.introductoryPriceCycles || 1,
                        price: null, // formatted price not available
                        priceMicros: introPriceMicros,
                        currency: currency,
                    });
                }

                pricingPhases.push({
                    paymentMode: 'PayAsYouGo',
                    recurrenceMode: store.INFINITE_RECURRING,
                    period: vp.subscriptionPeriod || toISO8601Duration(billingPeriodUnit, billingPeriod), // ISO8601 duration
                    cycles: 0,
                    price: price,
                    priceMicros: priceMicros,
                    currency: currency,
                });
                attributes.pricingPhases = pricingPhases;

                if (store.compatibility > 0 && store.compatibility < 11.999) {
                    Object.assign(attributes, {
                        price: price,
                        priceMicros: priceMicros,
                        currency: currency,
                        trialPeriod: trialPeriod,
                        trialPeriodUnit: trialPeriodUnit,
                        billingPeriod: billingPeriod,
                        billingPeriodUnit: billingPeriodUnit,
                        introPrice: introPrice,
                        introPriceMicros: introPriceMicros,
                        introPricePeriod: introPricePeriod,
                        introPricePeriodUnit: introPricePeriodUnit,
                        introPricePaymentMode: introPricePaymentMode,
                    });
                }

                if (store.compatibility > 0 && store.compatibility < 9.999) {
                    Object.assign(attributes, {
                        introPriceNumberOfPeriods: introPricePeriod,
                        introPriceSubscriptionPeriod: introPricePeriodUnit,
                    });
                }

                p.set(attributes);
                p.trigger("loaded");
            }
            */
            onInAppLoaded(p, vp) {
                var _a, _b, _c, _d;
                // console.log('iabInAppLoaded: ' + JSON.stringify(vp));
                const existingOffer = this.getOffer(vp.productId);
                const pricingPhases = [{
                        price: (_b = (_a = vp.formatted_price) !== null && _a !== void 0 ? _a : vp.price) !== null && _b !== void 0 ? _b : `${((_c = vp.price_amount_micros) !== null && _c !== void 0 ? _c : 0) / 1000000} ${vp.price_currency_code}`,
                        priceMicros: (_d = vp.price_amount_micros) !== null && _d !== void 0 ? _d : 0,
                        currency: vp.price_currency_code,
                        recurrenceMode: CdvPurchase.RecurrenceMode.NON_RECURRING,
                    }];
                if (existingOffer) {
                    // state: store.VALID,
                    // title: vp.name || trimTitle(vp.title),
                    // description: vp.description,
                    // currency: vp.price_currency_code || "",
                    // price: vp.formatted_price || vp.price,
                    // priceMicros: vp.price_amount_micros,
                    existingOffer.pricingPhases = pricingPhases;
                    p.offers = [existingOffer];
                }
                else {
                    const newOffer = new InAppOffer({ id: vp.productId, product: p, pricingPhases });
                    this.offers.push(newOffer);
                    p.offers = [newOffer];
                }
                // p.set({
                //     state: store.VALID,
                //     title: vp.name || trimTitle(vp.title),
                //     description: vp.description,
                //     currency: vp.price_currency_code || "",
                //     price: vp.formatted_price || vp.price,
                //     priceMicros: vp.price_amount_micros,
                // });
                // p.trigger("loaded");
                return p;
            }
            toPaymentMode(phase) {
                return phase.price_amount_micros === 0
                    ? CdvPurchase.PaymentMode.FREE_TRIAL
                    : phase.recurrence_mode === GooglePlay.Bridge.RecurrenceMode.NON_RECURRING
                        ? CdvPurchase.PaymentMode.UP_FRONT
                        : CdvPurchase.PaymentMode.PAY_AS_YOU_GO;
            }
            toRecurrenceMode(mode) {
                switch (mode) {
                    case GooglePlay.Bridge.RecurrenceMode.FINITE_RECURRING: return CdvPurchase.RecurrenceMode.FINITE_RECURRING;
                    case GooglePlay.Bridge.RecurrenceMode.INFINITE_RECURRING: return CdvPurchase.RecurrenceMode.INFINITE_RECURRING;
                    case GooglePlay.Bridge.RecurrenceMode.NON_RECURRING: return CdvPurchase.RecurrenceMode.NON_RECURRING;
                }
            }
            toPricingPhase(phase) {
                return {
                    price: phase.formatted_price,
                    priceMicros: phase.price_amount_micros,
                    currency: phase.price_currency_code,
                    billingPeriod: phase.billing_period,
                    billingCycles: phase.billing_cycle_count,
                    recurrenceMode: this.toRecurrenceMode(phase.recurrence_mode),
                    paymentMode: this.toPaymentMode(phase),
                };
            }
        }
        GooglePlay.Products = Products;
    })(GooglePlay = CdvPurchase.GooglePlay || (CdvPurchase.GooglePlay = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let GooglePlay;
    (function (GooglePlay) {
        let PublisherAPI;
        (function (PublisherAPI) {
            let GoogleErrorReason;
            (function (GoogleErrorReason) {
                /** The subscription purchase is no longer available for query because it has been expired for too long. */
                GoogleErrorReason["SUBSCRIPTION_NO_LONGER_AVAILABLE"] = "subscriptionPurchaseNoLongerAvailable";
                /** The purchase token is no longer valid. */
                GoogleErrorReason["PURCHASE_TOKEN_NO_LONGER_VALID"] = "purchaseTokenNoLongerValid";
            })(GoogleErrorReason = PublisherAPI.GoogleErrorReason || (PublisherAPI.GoogleErrorReason = {}));
            /**
           * Those are actually HTTP status codes.
           *
           * Duplicated here for documentation purposes.
           */
            let ErrorCode;
            (function (ErrorCode) {
                /** The subscription purchase is no longer available for query because it has been expired for too long. */
                ErrorCode[ErrorCode["GONE"] = 410] = "GONE";
            })(ErrorCode = PublisherAPI.ErrorCode || (PublisherAPI.ErrorCode = {}));
        })(PublisherAPI = GooglePlay.PublisherAPI || (GooglePlay.PublisherAPI = {}));
    })(GooglePlay = CdvPurchase.GooglePlay || (CdvPurchase.GooglePlay = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Test;
    (function (Test) {
        class Adapter {
            constructor() {
                this.id = CdvPurchase.Platform.TEST;
                this.name = 'Test';
                this.products = [];
                this.receipts = [];
            }
            initialize() {
                return __awaiter(this, void 0, void 0, function* () { return; });
            }
            load(products) {
                return __awaiter(this, void 0, void 0, function* () {
                    return products.map(p => ({ code: CdvPurchase.ErrorCode.PRODUCT_NOT_AVAILABLE, message: 'TODO' }));
                });
            }
            order(offer) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'TODO: Not implemented'
                    };
                });
            }
            finish(transaction) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'TODO: Not implemented'
                    };
                });
            }
            receiptValidationBody(receipt) {
                return;
            }
            handleReceiptValidationResponse(receipt, response) {
                return __awaiter(this, void 0, void 0, function* () {
                    return;
                });
            }
            requestPayment(payment, additionalData) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'requestPayment not supported',
                    };
                });
            }
        }
        Test.Adapter = Adapter;
    })(Test = CdvPurchase.Test || (CdvPurchase.Test = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let WindowsStore;
    (function (WindowsStore) {
        class Adapter {
            constructor() {
                this.id = CdvPurchase.Platform.WINDOWS_STORE;
                this.name = 'WindowsStore';
                this.products = [];
                this.receipts = [];
            }
            initialize() {
                return __awaiter(this, void 0, void 0, function* () { return; });
            }
            load(products) {
                return __awaiter(this, void 0, void 0, function* () {
                    return products.map(p => ({ code: CdvPurchase.ErrorCode.PRODUCT_NOT_AVAILABLE, message: 'TODO' }));
                });
            }
            order(offer) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'TODO: Not implemented'
                    };
                });
            }
            finish(transaction) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'TODO: Not implemented'
                    };
                });
            }
            handleReceiptValidationResponse(receipt, response) {
                return __awaiter(this, void 0, void 0, function* () {
                    return;
                });
            }
            receiptValidationBody(receipt) {
                return;
            }
            requestPayment(payment, additionalData) {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        code: CdvPurchase.ErrorCode.UNKNOWN,
                        message: 'requestPayment not supported',
                    };
                });
            }
        }
        WindowsStore.Adapter = Adapter;
    })(WindowsStore = CdvPurchase.WindowsStore || (CdvPurchase.WindowsStore = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Utils;
    (function (Utils) {
        /**
         * Simplified version of jQuery's ajax method based on XMLHttpRequest.
         *
         * Uses cordova's http plugin when installed.
         *
         * Only supports JSON requests.
         */
        function ajax(log, options) {
            if (typeof window !== 'undefined' && window.cordova && window.cordova.plugin && window.cordova.plugin.http) {
                return ajaxWithHttpPlugin(log, options);
            }
            var doneCb = function () { };
            var xhr = new XMLHttpRequest();
            xhr.open(options.method || 'POST', options.url, true);
            xhr.onreadystatechange = function ( /*event*/) {
                try {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            Utils.callExternal(log, 'ajax.success', options.success, JSON.parse(xhr.responseText));
                        }
                        else {
                            log.warn("ajax -> request to " + options.url + " failed with status " + xhr.status + " (" + xhr.statusText + ")");
                            Utils.callExternal(log, 'ajax.error', options.error, xhr.status, xhr.statusText);
                        }
                    }
                }
                catch (e) {
                    log.warn("ajax -> request to " + options.url + " failed with an exception: " + e.message);
                    if (options.error)
                        options.error(417, e.message, null);
                }
                if (xhr.readyState === 4)
                    Utils.callExternal(log, 'ajax.done', doneCb);
            };
            const customHeaders = options.customHeaders;
            if (customHeaders) {
                Object.keys(customHeaders).forEach(function (header) {
                    log.debug('ajax -> adding custom header: ' + header);
                    xhr.setRequestHeader(header, customHeaders[header]);
                });
            }
            xhr.setRequestHeader("Accept", "application/json");
            log.debug('ajax -> send request to ' + options.url);
            if (options.data) {
                xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                xhr.send(JSON.stringify(options.data));
            }
            else {
                xhr.send();
            }
            return {
                done: function (cb) { doneCb = cb; return this; }
            };
        }
        Utils.ajax = ajax;
        /**
         * Simplified version of jQuery's ajax method based on XMLHttpRequest.
         *
         * Uses the http plugin.
         */
        function ajaxWithHttpPlugin(log, options) {
            let doneCb = function () { };
            const ajaxOptions = {
                method: (options.method || 'get').toLowerCase(),
                data: options.data,
                serializer: 'json',
                // responseType: 'json',
            };
            if (options.customHeaders) {
                log.debug('ajax[http] -> adding custom headers: ' + JSON.stringify(options.customHeaders));
                ajaxOptions.headers = options.customHeaders;
            }
            log.debug('ajax[http] -> send request to ' + options.url);
            const ajaxDone = (response) => {
                try {
                    if (response.status == 200) {
                        Utils.callExternal(log, 'ajax.success', options.success, JSON.parse(response.data));
                    }
                    else {
                        log.warn("ajax[http] -> request to " + options.url + " failed with status " + response.status + " (" + response.error + ")");
                        Utils.callExternal(log, 'ajax.error', options.error, response.status, response.error);
                    }
                }
                catch (e) {
                    log.warn("ajax[http] -> request to " + options.url + " failed with an exception: " + e.message);
                    if (options.error)
                        Utils.callExternal(log, 'ajax.error', options.error, 417, e.message);
                }
                Utils.callExternal(log, 'ajax.done', doneCb);
            };
            window.cordova.plugin.http.sendRequest(options.url, ajaxOptions, ajaxDone, ajaxDone);
            return {
                done: function (cb) { doneCb = cb; return this; }
            };
        }
    })(Utils = CdvPurchase.Utils || (CdvPurchase.Utils = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Utils;
    (function (Utils) {
        /**
         * Calls an user-registered callback.
         *
         * Won't throw exceptions, only logs errors.
         *
         * @param name a short string describing the callback
         * @param callback the callback to call (won't fail if undefined)
         *
         * @example
         * ```js
         * Utils.callExternal(store.log, "ajax.error", options.error, 404, "Not found");
         * ```
         */
        function callExternal(log, name, callback, ...args) {
            try {
                const args = Array.prototype.slice.call(arguments, 3);
                // store.log.debug("calling " + name + "(" + JSON.stringify(args2) + ")");
                if (callback)
                    callback.apply(CdvPurchase.Store.instance, args);
            }
            catch (e) {
                log.logCallbackException(name, e);
            }
        }
        Utils.callExternal = callExternal;
    })(Utils = CdvPurchase.Utils || (CdvPurchase.Utils = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Utils;
    (function (Utils) {
        function delay(fn, wait) {
            return setTimeout(fn, wait);
        }
        Utils.delay = delay;
        function debounce(fn, wait) {
            let timeout = null;
            const later = function (context, args) {
                timeout = null;
                fn();
            };
            const debounced = function () {
                if (timeout)
                    window.clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
            return debounced;
        }
        Utils.debounce = debounce;
    })(Utils = CdvPurchase.Utils || (CdvPurchase.Utils = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Utils;
    (function (Utils) {
        const HEX2STR = "0123456789abcdef".split("");
        function toHexString(r) {
            for (var n = "", e = 0; e < 4; e++)
                n += HEX2STR[r >> 8 * e + 4 & 15] + HEX2STR[r >> 8 * e & 15];
            return n;
        }
        function hexStringFromArray(array) {
            const out = [];
            for (var arrayLength = array.length, i = 0; i < arrayLength; i++)
                out.push(toHexString(array[i]));
            return out.join("");
        }
        function add32(r, n) {
            return r + n & 4294967295;
        }
        function complexShift(r, n, e, t, o, u, shiftFunction) {
            function shiftAdd32(op0, op1, v1) {
                return add32(op0 << op1 | op0 >>> 32 - op1, v1);
            }
            function add32x4(i0, i1, j0, j1) {
                return add32(add32(i1, i0), add32(j0, j1));
            }
            return shiftAdd32(add32x4(r, n, t, u), o, e);
        }
        var step1Function = function (shiftFunction, n, e, t, o, u, f, a) { return complexShift(e & t | ~e & o, n, e, u, f, a, shiftFunction); };
        var step2Function = function (shiftFunction, n, e, t, o, u, f, a) { return complexShift(e & o | t & ~o, n, e, u, f, a, shiftFunction); };
        var step3Function = function (shiftFunction, n, e, t, o, u, f, a) { return complexShift(e ^ t ^ o, n, e, u, f, a, shiftFunction); };
        var step4Function = function (shiftFunction, n, e, t, o, u, f, a) { return complexShift(t ^ (e | ~o), n, e, u, f, a, shiftFunction); };
        function hashStep(inOutVec4, strAsInts, shiftFunction) {
            if (!shiftFunction)
                shiftFunction = add32;
            let v0 = inOutVec4[0];
            let v1 = inOutVec4[1];
            let v2 = inOutVec4[2];
            let v3 = inOutVec4[3];
            var step1 = step1Function.bind(null, shiftFunction);
            v0 = step1(v0, v1, v2, v3, strAsInts[0], 7, -680876936);
            v3 = step1(v3, v0, v1, v2, strAsInts[1], 12, -389564586);
            v2 = step1(v2, v3, v0, v1, strAsInts[2], 17, 606105819);
            v1 = step1(v1, v2, v3, v0, strAsInts[3], 22, -1044525330);
            v0 = step1(v0, v1, v2, v3, strAsInts[4], 7, -176418897);
            v3 = step1(v3, v0, v1, v2, strAsInts[5], 12, 1200080426);
            v2 = step1(v2, v3, v0, v1, strAsInts[6], 17, -1473231341);
            v1 = step1(v1, v2, v3, v0, strAsInts[7], 22, -45705983);
            v0 = step1(v0, v1, v2, v3, strAsInts[8], 7, 1770035416);
            v3 = step1(v3, v0, v1, v2, strAsInts[9], 12, -1958414417);
            v2 = step1(v2, v3, v0, v1, strAsInts[10], 17, -42063);
            v1 = step1(v1, v2, v3, v0, strAsInts[11], 22, -1990404162);
            v0 = step1(v0, v1, v2, v3, strAsInts[12], 7, 1804603682);
            v3 = step1(v3, v0, v1, v2, strAsInts[13], 12, -40341101);
            v2 = step1(v2, v3, v0, v1, strAsInts[14], 17, -1502002290);
            v1 = step1(v1, v2, v3, v0, strAsInts[15], 22, 1236535329);
            var step2 = step2Function.bind(null, shiftFunction);
            v0 = step2(v0, v1, v2, v3, strAsInts[1], 5, -165796510);
            v3 = step2(v3, v0, v1, v2, strAsInts[6], 9, -1069501632);
            v2 = step2(v2, v3, v0, v1, strAsInts[11], 14, 643717713);
            v1 = step2(v1, v2, v3, v0, strAsInts[0], 20, -373897302);
            v0 = step2(v0, v1, v2, v3, strAsInts[5], 5, -701558691);
            v3 = step2(v3, v0, v1, v2, strAsInts[10], 9, 38016083);
            v2 = step2(v2, v3, v0, v1, strAsInts[15], 14, -660478335);
            v1 = step2(v1, v2, v3, v0, strAsInts[4], 20, -405537848);
            v0 = step2(v0, v1, v2, v3, strAsInts[9], 5, 568446438);
            v3 = step2(v3, v0, v1, v2, strAsInts[14], 9, -1019803690);
            v2 = step2(v2, v3, v0, v1, strAsInts[3], 14, -187363961);
            v1 = step2(v1, v2, v3, v0, strAsInts[8], 20, 1163531501);
            v0 = step2(v0, v1, v2, v3, strAsInts[13], 5, -1444681467);
            v3 = step2(v3, v0, v1, v2, strAsInts[2], 9, -51403784);
            v2 = step2(v2, v3, v0, v1, strAsInts[7], 14, 1735328473);
            v1 = step2(v1, v2, v3, v0, strAsInts[12], 20, -1926607734);
            var step3 = step3Function.bind(null, shiftFunction);
            v0 = step3(v0, v1, v2, v3, strAsInts[5], 4, -378558);
            v3 = step3(v3, v0, v1, v2, strAsInts[8], 11, -2022574463);
            v2 = step3(v2, v3, v0, v1, strAsInts[11], 16, 1839030562);
            v1 = step3(v1, v2, v3, v0, strAsInts[14], 23, -35309556);
            v0 = step3(v0, v1, v2, v3, strAsInts[1], 4, -1530992060);
            v3 = step3(v3, v0, v1, v2, strAsInts[4], 11, 1272893353);
            v2 = step3(v2, v3, v0, v1, strAsInts[7], 16, -155497632);
            v1 = step3(v1, v2, v3, v0, strAsInts[10], 23, -1094730640);
            v0 = step3(v0, v1, v2, v3, strAsInts[13], 4, 681279174);
            v3 = step3(v3, v0, v1, v2, strAsInts[0], 11, -358537222);
            v2 = step3(v2, v3, v0, v1, strAsInts[3], 16, -722521979);
            v1 = step3(v1, v2, v3, v0, strAsInts[6], 23, 76029189);
            v0 = step3(v0, v1, v2, v3, strAsInts[9], 4, -640364487);
            v3 = step3(v3, v0, v1, v2, strAsInts[12], 11, -421815835);
            v2 = step3(v2, v3, v0, v1, strAsInts[15], 16, 530742520);
            v1 = step3(v1, v2, v3, v0, strAsInts[2], 23, -995338651);
            var step4 = step4Function.bind(null, shiftFunction);
            v0 = step4(v0, v1, v2, v3, strAsInts[0], 6, -198630844);
            v3 = step4(v3, v0, v1, v2, strAsInts[7], 10, 1126891415);
            v2 = step4(v2, v3, v0, v1, strAsInts[14], 15, -1416354905);
            v1 = step4(v1, v2, v3, v0, strAsInts[5], 21, -57434055);
            v0 = step4(v0, v1, v2, v3, strAsInts[12], 6, 1700485571);
            v3 = step4(v3, v0, v1, v2, strAsInts[3], 10, -1894986606);
            v2 = step4(v2, v3, v0, v1, strAsInts[10], 15, -1051523);
            v1 = step4(v1, v2, v3, v0, strAsInts[1], 21, -2054922799);
            v0 = step4(v0, v1, v2, v3, strAsInts[8], 6, 1873313359);
            v3 = step4(v3, v0, v1, v2, strAsInts[15], 10, -30611744);
            v2 = step4(v2, v3, v0, v1, strAsInts[6], 15, -1560198380);
            v1 = step4(v1, v2, v3, v0, strAsInts[13], 21, 1309151649);
            v0 = step4(v0, v1, v2, v3, strAsInts[4], 6, -145523070);
            v3 = step4(v3, v0, v1, v2, strAsInts[11], 10, -1120210379);
            v2 = step4(v2, v3, v0, v1, strAsInts[2], 15, 718787259);
            v1 = step4(v1, v2, v3, v0, strAsInts[9], 21, -343485551);
            inOutVec4[0] = shiftFunction(v0, inOutVec4[0]);
            inOutVec4[1] = shiftFunction(v1, inOutVec4[1]);
            inOutVec4[2] = shiftFunction(v2, inOutVec4[2]);
            inOutVec4[3] = shiftFunction(v3, inOutVec4[3]);
        }
        ;
        function stringToIntArray(r) {
            for (var ret = [], e = 0; e < 64; e += 4)
                ret[e >> 2] = r.charCodeAt(e) + (r.charCodeAt(e + 1) << 8) + (r.charCodeAt(e + 2) << 16) + (r.charCodeAt(e + 3) << 24);
            return ret;
        }
        function computeMD5(str, shiftFunction) {
            let lastCharIndex;
            const strLength = str.length;
            const vec4 = [1732584193, -271733879, -1732584194, 271733878];
            for (lastCharIndex = 64; lastCharIndex <= strLength; lastCharIndex += 64)
                hashStep(vec4, stringToIntArray(str.substring(lastCharIndex - 64, lastCharIndex)), shiftFunction);
            const vec16 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            const reminderLength = (str = str.substring(lastCharIndex - 64)).length;
            // process by batch of 64
            let vec16Index;
            for (vec16Index = 0; vec16Index < reminderLength; vec16Index++)
                vec16[vec16Index >> 2] |= str.charCodeAt(vec16Index) << (vec16Index % 4 << 3);
            vec16[vec16Index >> 2] |= 128 << (vec16Index % 4 << 3);
            if (vec16Index > 55) {
                hashStep(vec4, vec16, shiftFunction);
                for (vec16Index = 16; vec16Index--;)
                    vec16[vec16Index] = 0;
            }
            vec16[14] = 8 * strLength;
            hashStep(vec4, vec16, shiftFunction);
            return vec4;
        }
        ;
        /**
         * Returns the MD5 hash-value of the passed string.
         *
         * Based on the work of Jeff Mott, who did a pure JS implementation of the MD5 algorithm that was published by Ronald L. Rivest in 1991.
         * Code was imported from https://github.com/pvorb/node-md5
         *
         * I cleaned up the all-including minified version of it.
         */
        function md5(str) {
            if (!str)
                return '';
            let shiftFunction;
            if ("5d41402abc4b2a76b9719d911017c592" !== hexStringFromArray(computeMD5("hello")))
                shiftFunction = function (r, n) {
                    const e = (65535 & r) + (65535 & n);
                    return (r >> 16) + (n >> 16) + (e >> 16) << 16 | 65535 & e;
                };
            return hexStringFromArray(computeMD5(str, shiftFunction));
        }
        Utils.md5 = md5;
    })(Utils = CdvPurchase.Utils || (CdvPurchase.Utils = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Utils;
    (function (Utils) {
        function getCryptoExtension() {
            return (window.crypto || window.msCrypto);
        }
        /** Returns an UUID v4. Uses `window.crypto` internally to generate random values. */
        function uuidv4() {
            // @ts-ignore
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
                return (c ^ getCryptoExtension().getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
            });
        }
        Utils.uuidv4 = uuidv4;
    })(Utils = CdvPurchase.Utils || (CdvPurchase.Utils = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Validator;
    (function (Validator) {
        let Internal;
        (function (Internal) {
            function isArray(arg) {
                return Object.prototype.toString.call(arg) === '[object Array]';
            }
            function isObject(arg) {
                return Object.prototype.toString.call(arg) === '[object Object]';
            }
            // List of functions allowed by store.validator_privacy_policy
            function getPrivacyPolicy(store) {
                if (typeof store.validator_privacy_policy === 'string')
                    return store.validator_privacy_policy.split(',');
                else if (isArray(store.validator_privacy_policy))
                    return store.validator_privacy_policy;
                else // default: no tracking
                    return ['analytics', 'support', 'fraud'];
            }
            function getDeviceInfo(store) {
                const privacyPolicy = getPrivacyPolicy(store); // string[]
                function allowed(policy) {
                    return privacyPolicy.indexOf(policy) >= 0;
                }
                // Different versions of the plugin use different response fields.
                // Sending this information allows the validator to reply with only expected information.
                const ret = {
                    plugin: 'cordova-plugin-purchase/' + CdvPurchase.PLUGIN_VERSION,
                };
                const wdw = window;
                // the cordova-plugin-device global object
                const device = isObject(wdw.device) ? wdw.device : {};
                // Send the receipt validator information about the device.
                // This will allow to make vendor or device specific fixes and detect class
                // of devices with issues.
                // Knowing running version of OS and libraries also required for handling
                // support requests.
                if (allowed('analytics') || allowed('support')) {
                    // Version of ionic (if applicable)
                    const ionic = wdw.Ionic || wdw.ionic;
                    if (ionic && ionic.version)
                        ret.ionic = ionic.version;
                    // Information from the cordova-plugin-device (if installed)
                    if (device.cordova)
                        ret.cordova = device.cordova; // Version of cordova
                    if (device.model)
                        ret.model = device.model; // Device model
                    if (device.platform)
                        ret.platform = device.platform; // OS
                    if (device.version)
                        ret.version = device.version; // OS version
                    if (device.manufacturer)
                        ret.manufacturer = device.manufacturer; // Device manufacturer
                }
                // Device identifiers are used for tracking users across services
                // It is sometimes required for support requests too, but I choose to
                // keep this out.
                if (allowed('tracking')) {
                    if (device.serial)
                        ret.serial = device.serial; // Hardware serial number
                    if (device.uuid)
                        ret.uuid = device.uuid; // Device UUID
                }
                // Running from a simulator is an error condition for in-app purchases.
                // Since only developers run in a simulator, let's always report that.
                if (device.isVirtual)
                    ret.isVirtual = device.isVirtual; // Simulator
                // Probably nobody wants to disable fraud discovery.
                // A fingerprint of the device identifiers is used for fraud discovery.
                // An alert should be triggered by the validator when a lot of devices
                // share a single receipt.
                if (allowed('fraud')) {
                    // For fraud discovery, we only need a fingerprint of the device.
                    var fingerprint = '';
                    if (device.serial)
                        fingerprint = 'serial:' + device.serial; // Hardware serial number
                    else if (device.uuid)
                        fingerprint = 'uuid:' + device.uuid; // Device UUID
                    else {
                        // Using only model and manufacturer, we might end-up with many
                        // users sharing the same fingerprint, which is fine for fraud discovery.
                        if (device.model)
                            fingerprint += '/' + device.model;
                        if (device.manufacturer)
                            fingerprint = '/' + device.manufacturer;
                    }
                    // Fingerprint is hashed to keep required level of privacy.
                    if (fingerprint)
                        ret.fingerprint = CdvPurchase.Utils.md5(fingerprint);
                }
                return ret;
            }
            Internal.getDeviceInfo = getDeviceInfo;
        })(Internal = Validator.Internal || (Validator.Internal = {}));
    })(Validator = CdvPurchase.Validator || (CdvPurchase.Validator = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    let Validator;
    (function (Validator) {
        let Request;
        (function (Request) {
            ;
        })(Request = Validator.Request || (Validator.Request = {}));
    })(Validator = CdvPurchase.Validator || (CdvPurchase.Validator = {}));
})(CdvPurchase || (CdvPurchase = {}));
var CdvPurchase;
(function (CdvPurchase) {
    /** Receipt data as validated by the receipt validation server */
    class VerifiedReceipt {
        constructor(receipt, response) {
            var _a;
            this.id = response.id;
            this.sourceReceipt = receipt;
            this.collection = (_a = response.collection) !== null && _a !== void 0 ? _a : [];
            this.latestReceipt = response.latest_receipt;
            this.nativeTransactions = [response.transaction];
            this.warning = response.warning;
        }
        /** Platform this receipt originated from */
        get platform() { return this.sourceReceipt.platform; }
        /** Update the receipt content */
        set(receipt, response) {
            var _a;
            this.id = response.id;
            this.sourceReceipt = receipt;
            this.collection = (_a = response.collection) !== null && _a !== void 0 ? _a : [];
            this.latestReceipt = response.latest_receipt;
            this.nativeTransactions = [response.transaction];
            this.warning = response.warning;
        }
    }
    CdvPurchase.VerifiedReceipt = VerifiedReceipt;
})(CdvPurchase || (CdvPurchase = {}));
