/// <reference path="validator/validator.ts" />
/// <reference path="log.ts" />
/// <reference path="internal/adapters.ts" />
/// <reference path="internal/callbacks.ts" />
/// <reference path="internal/ready.ts" />

/**
 * Namespace for the cordova-plugin-purchase plugin.
 *
 * All classes, enumerations and variables defined by the plugin are in this namespace.
 *
 * Throughout the documentation, in order to keep examples readable, we omit the `CdvPurchase` prefix.
 *
 * When you see, for example `ProductType.PAID_SUBSCRIPTION`, it refers to `CdvPurchase.ProductType.PAID_SUBSCRIPTION`.
 *
 * In the files that interact with the plugin, I recommend creating those shortcuts (and more if needed):
 *
 * ```ts
 * const {store, ProductType, Platform, LogLevel} = CdvPurchase;
 * ```
 */
namespace CdvPurchase {

    /**
     * Current release number of the plugin.
     */
    export const PLUGIN_VERSION = '13.0.0';

    /**
     * Entry class of the plugin.
     */
    export class Store {

        /**
         * Payment platform adapters.
         */
        private adapters = new Internal.Adapters();

        /**
         * Retrieve a platform adapter.
         *
         * The platform adapter has to have been initialized before.
         *
         * @see {@link initialize}
         */
        getAdapter(platform: Platform) {
            return this.adapters.find(platform);
        }

        /**
         * List of registered products.
         *
         * Products are added to this list of products by {@link Store.register}, an internal job will defer loading to the platform adapters.
         */
        private registeredProducts = new Internal.RegisteredProducts();

        /** Logger */
        public log = new Logger(this);

        /**
         * Verbosity level used by the plugin logger
         *
         * Set to:
         *
         *  - LogLevel.QUIET or 0 to disable all logging (default)
         *  - LogLevel.ERROR or 1 to show only error messages
         *  - LogLevel.WARNING or 2 to show warnings and errors
         *  - LogLevel.INFO or 3 to also show information messages
         *  - LogLevel.DEBUG or 4 to enable internal debugging messages.
         *
         * @see {@link LogLevel}
         */
        public verbosity: LogLevel = LogLevel.ERROR;

        /** Return the identifier of the user for your application */
        public applicationUsername?: string | (() => string);

        /**
         * Get the application username as a string by either calling or returning {@link Store.applicationUsername}
        */
        getApplicationUsername(): string | undefined {
            if (this.applicationUsername instanceof Function) return this.applicationUsername();
            return this.applicationUsername;
        }

        /**
         * URL or implementation of the receipt validation service
         *
         * @example
         * Define the validator as a string
         * ```ts
         * CdvPurchase.store.validator = "https://validator.iaptic.com/v1/validate?appName=test"
         * ```
         *
         * @example
         * Define the validator as a function
         * ```ts
         * CdvPurchase.store.validator = (receipt, callback) => {
         *   callback({
         *     ok: true,
         *     data: {
         *       // see CdvPurchase.Validator.Response.Payload for details
         *     }
         *   })
         * }
         * ```
         *
         * @see {@link CdvPurchase.Validator.Response.Payload}
         */
        public validator: string | Validator.Function | Validator.Target | undefined;

        /**
         * When adding information to receipt validation requests, those can serve different functions:
         *
         *  - handling support requests
         *  - fraud detection
         *  - analytics
         *  - tracking
         *
         * Make sure the value your select is in line with your application's privacy policy and your users' tracking preference.
         *
         * @example
         * CdvPurchase.store.validator_privacy_policy = [
         *   'fraud', 'support', 'analytics', 'tracking'
         * ]
         */
        public validator_privacy_policy: PrivacyPolicyItem | PrivacyPolicyItem[] | undefined;

        /** List of callbacks for the "ready" events */
        private _readyCallbacks = new Internal.ReadyCallbacks();

        /** Listens to adapters */
        private listener: Internal.StoreAdapterListener;

        /** Callbacks when a product definition was updated */
        private updatedCallbacks = new Internal.Callbacks<Product>();

        /** Callback when a receipt was updated */
        private updatedReceiptsCallbacks = new Internal.Callbacks<Receipt>();

        /** Callbacks when a product is owned */
        // private ownedCallbacks = new Callbacks<Product>();

        /** Callbacks when a transaction has been approved */
        private approvedCallbacks = new Internal.Callbacks<Transaction>();

        /** Callbacks when a transaction has been finished */
        private finishedCallbacks = new Internal.Callbacks<Transaction>();

        /** Callbacks when a receipt has been validated */
        private verifiedCallbacks = new Internal.Callbacks<VerifiedReceipt>();

        /** Callbacks for errors */
        private errorCallbacks = new Internal.Callbacks<IError>;

        /** Internal implementation of the receipt validation service integration */
        private _validator: Internal.Validator;

        constructor() {
            this.listener = new Internal.StoreAdapterListener({
                updatedCallbacks: this.updatedCallbacks,
                updatedReceiptCallbacks: this.updatedReceiptsCallbacks,
                approvedCallbacks: this.approvedCallbacks,
                finishedCallbacks: this.finishedCallbacks,
            });

            const store = this;
            this._validator = new Internal.Validator({
                adapters: this.adapters,
                getApplicationUsername: this.getApplicationUsername.bind(this),
                get localReceipts() { return store.localReceipts; },
                get validator() { return store.validator; },
                get validator_privacy_policy() { return store.validator_privacy_policy; },
                verifiedCallbacks: this.verifiedCallbacks,
            }, this.log);
        }

        /**
         * Register a product.
         *
         * @example
         * store.register([{
         *       id: 'subscription1',
         *       type: ProductType.PAID_SUBSCRIPTION,
         *       platform: Platform.APPLE_APPSTORE,
         *   }, {
         *       id: 'subscription1',
         *       type: ProductType.PAID_SUBSCRIPTION,
         *       platform: Platform.GOOGLE_PLAY,
         *   }, {
         *       id: 'consumable1',
         *       type: ProductType.CONSUMABLE,
         *       platform: Platform.BRAINTREE,
         *   }]);
         */
        register(product: IRegisterProduct | IRegisterProduct[]) {
            this.registeredProducts.add(product);
        }

        /**
         * Call to initialize the in-app purchase plugin.
         *
         * @param platforms - List of payment platforms to initialize, default to Store.defaultPlatform().
         */
        async initialize(platforms: (Platform | PlatformWithOptions)[] = [Store.defaultPlatform()]): Promise<IError[]> {
            const store = this;
            const ret = this.adapters.initialize(platforms, {
                error: this.error.bind(this),
                get verbosity() { return store.verbosity; },
                getApplicationUsername() { return store.getApplicationUsername() },
                listener: this.listener,
                log: this.log,
                registeredProducts: this.registeredProducts,
                apiDecorators: {
                    canPurchase: this.canPurchase,
                    owned: this.owned,
                    finish: this.finish,
                    order: this.order,
                    verify: this.verify,
                },
            });
            ret.then(() => this._readyCallbacks.trigger());
            return ret;
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
        async update() {
            // Load products metadata
            for (const registration of this.registeredProducts.byPlatform()) {
                const products = await this.adapters.findReady(registration.platform)?.load(registration.products);
                products?.forEach(p => {
                    if (p instanceof Product) this.updatedCallbacks.trigger(p);
                });
            }
        }

        /** Register a callback to be called when the plugin is ready. */
        ready(cb: Callback<void>): void { this._readyCallbacks.add(cb); }

        /** Setup events listener.
         *
         * @example
         * store.when()
         *      .productUpdated(product => updateUI(product))
         *      .approved(transaction => store.finish(transaction));
         */
        when() {
            const ret: When = {
                productUpdated: (cb: Callback<Product>) => (this.updatedCallbacks.push(cb), ret),
                receiptUpdated: (cb: Callback<Receipt>) => (this.updatedReceiptsCallbacks.push(cb), ret),
                updated: (cb: Callback<Product | Receipt>) => (this.updatedCallbacks.push(cb), this.updatedReceiptsCallbacks.push(cb), ret),
                // owned: (cb: Callback<Product>) => (this.ownedCallbacks.push(cb), ret),
                approved: (cb: Callback<Transaction>) => (this.approvedCallbacks.push(cb), ret),
                finished: (cb: Callback<Transaction>) => (this.finishedCallbacks.push(cb), ret),
                verified: (cb: Callback<VerifiedReceipt>) => (this.verifiedCallbacks.push(cb), ret),
            };
            return ret;
        }


        /** List of all active products */
        get products(): Product[] {
            // concatenate products all all active platforms
            return ([] as Product[]).concat(...this.adapters.list.map(a => a.products));
        }

        /** Find a product from its id and platform */
        get(productId: string, platform: Platform = Store.defaultPlatform()): Product | undefined {
            return this.adapters.find(platform)?.products.find(p => p.id === productId);
        }

        /**
         * List of all receipts as present on the device.
         */
        get localReceipts(): Receipt[] {
            // concatenate products all all active platforms
            return ([] as Receipt[]).concat(...this.adapters.list.map(a => a.receipts));
        }

        /** List of all transaction from the local receipts. */
        get localTransactions(): Transaction[] {
            const ret: Transaction[] = [];
            for (const receipt of this.localReceipts) {
                ret.push(...receipt.transactions);
            }
            return ret;
        }

        /** List of receipts verified with the receipt validation service.
         *
         * Those receipt contains more information and are generally more up-to-date than the local ones. */
        get verifiedReceipts(): VerifiedReceipt[] {
            return this._validator.verifiedReceipts;
        }

        /** List of all purchases from the verified receipts. */
        get verifiedPurchases(): VerifiedPurchase[] {
            return Internal.VerifiedReceipts.getVerifiedPurchases(this.verifiedReceipts);
        }

        /**
         * Find the last verified purchase for a given product, from those verified by the receipt validator.
         */
        findInVerifiedReceipts(product: Product): VerifiedPurchase | undefined {
            return Internal.VerifiedReceipts.find(this.verifiedReceipts, product);
        }

        /**
         * Find the latest transaction for a given product, from those reported by the device.
         */
        findInLocalReceipts(product: Product): Transaction | undefined {
            return Internal.LocalReceipts.find(this.localReceipts, product);
        }

        /** Return true if a product or offer can be purchased */
        private canPurchase(offer: Offer | Product) {
            const product = (offer instanceof Offer) ? this.get(offer.productId, offer.platform) : offer;
            return Internal.LocalReceipts.canPurchase(this.localReceipts, product);
        }

        /**
         * Return true if a product is owned
         *
         * @param product - The product object or identifier of the product.
         */
        owned(product: { id: string; platform?: Platform } | string) {
            return Internal.owned({
                product: typeof product === 'string' ? { id: product } : product,
                verifiedReceipts: this.validator ? this.verifiedReceipts : undefined,
                localReceipts: this.localReceipts,
            });
        }

        /** Place an order for a given offer */
        async order(offer: Offer, additionalData?: AdditionalData): Promise<IError | undefined> {
            const adapter = this.adapters.findReady(offer.platform);
            if (!adapter) return storeError(ErrorCode.PAYMENT_NOT_ALLOWED, 'Adapter not found or not ready (' + offer.platform + ')');
            const ret = await adapter.order(offer, additionalData || {});
            if (ret && 'isError' in ret) store.error(ret);
            return ret;
        }

        /** Request a payment */
        async requestPayment(paymentRequest: PaymentRequest, additionalData?: AdditionalData): Promise<IError | undefined> {
            const adapter = this.adapters.findReady(paymentRequest.platform);
            if (!adapter) return storeError(ErrorCode.PAYMENT_NOT_ALLOWED, 'Adapter not found or not ready (' + paymentRequest.platform + ')');
            return adapter.requestPayment(paymentRequest, additionalData);
        }

        /** Verify a receipt or transacting with the receipt validation service. */
        private async verify(receiptOrTransaction: Transaction | Receipt) {
            this._validator.add(receiptOrTransaction);

            // Run validation after 50ms, so if the same receipt is to be validated multiple times it will just create one call.
            setTimeout(() => this._validator.run());

        }

        /** Finalize a transaction */
        async finish(receipt: Transaction | Receipt | VerifiedReceipt) {
            const transactions =
                receipt instanceof VerifiedReceipt
                    ? receipt.sourceReceipt.transactions
                    : receipt instanceof Receipt
                        ? receipt.transactions
                        : [receipt];
            transactions.forEach(transaction => {
                const adapter = this.adapters.find(transaction.platform)?.finish(transaction);
            });
        }

        async restorePurchases() {
            // TODO
        }

        async manageSubscriptions(platform?: Platform): Promise<IError | undefined> {
            const adapter = this.adapters.findReady(platform);
            if (!adapter) return storeError(ErrorCode.SETUP, "Found no adapter ready to handle 'manageSubscription'");
            return adapter.manageSubscriptions();
        }

        /**
         * The default payment platform to use depending on the OS.
         *
         * - on iOS: `APPLE_APPSTORE`
         * - on Android: `GOOGLE_PLAY`
         */
        static defaultPlatform(): Platform {
            switch (window.cordova.platformId) {
                case 'android': return Platform.GOOGLE_PLAY;
                case 'ios': return Platform.APPLE_APPSTORE;
                default: return Platform.TEST;
            }
        }

        error(error: IError | Callback<IError>): void {
            if (error instanceof Function)
                this.errorCallbacks.push(error);
            else
                this.errorCallbacks.trigger(error);
        }

        public version = PLUGIN_VERSION;
    }

    /**
     * The global store object.
     */
    export let store: Store;

    //
    // Documentation for sub-namespaces
    //

    /**
     * @internal
     *
     * This namespace contains things never meant for being used directly by the user of the plugin.
     */
    export namespace Internal {}
}

// Create the CdvPurchase.store object at startup.
setTimeout(() => {
    window.CdvPurchase = CdvPurchase;
    window.CdvPurchase.store = new CdvPurchase.Store();
    // Let's maximize backward compatibility
    Object.assign(window.CdvPurchase.store, CdvPurchase.LogLevel, CdvPurchase.ProductType, CdvPurchase.ErrorCode);
}, 0);

// Ensure utility are included when compiling typescript.
/// <reference path="utils/format-billing-cycle.ts" />
