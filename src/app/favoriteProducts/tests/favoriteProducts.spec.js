describe('Component: FavoriteProducts', function(){
    var q,
        oc,
        scope,
        ocParams,
        parameters,
        favoriteProducts,
        currentUser,
        underscore,
        toaster,
        product;

    beforeEach(module('orderCloud'));
    beforeEach(module('orderCloud.sdk'));
    beforeEach(module(function($provide) {
        $provide.value('Parameters', {search:null, page: null, pageSize: null, searchOn: null, sortBy: null, userID: null, userGroupID: null, level: null, buyerID: null});
        $provide.value('FavoriteProducts', []);
        $provide.value('CurrentUser', {xp: {FavoriteProducts: ['favoriteProduct']}});
    }));
    beforeEach(inject(function($q, OrderCloud, $rootScope, Parameters, OrderCloudParameters, CurrentUser, FavoriteProducts, Underscore, toastr){
        q = $q;
        oc = OrderCloud;
        scope = $rootScope.$new();
        parameters = Parameters;
        ocParams = OrderCloudParameters;
        favoriteProducts = FavoriteProducts;
        currentUser = CurrentUser;
        underscore = Underscore;
        toaster = toastr;
        product = {
            ID: 'productID'
        };
    }));

    describe('State: favoriteProducts', function(){
        var state;
        beforeEach(inject(function($state){
            state = $state.get('favoriteProducts');
            var defer = q.defer();
            defer.resolve();
            spyOn(ocParams, 'Get').and.returnValue(null);
            spyOn(oc.Me, 'ListProducts').and.returnValue(defer.promise);
        }));
        it('should resolve Parameters', inject(function($injector){
            $injector.invoke(state.resolve.Parameters);
            expect(ocParams.Get).toHaveBeenCalled();
        }));
        it('should resolve FavoriteProducts', inject(function(CurrentUser, $injector){
            $injector.invoke(state.resolve.FavoriteProducts);
            currentUser.xp = {favoriteProducts: 'favoriteProduct'};
            expect(oc.Me.ListProducts).toHaveBeenCalledWith(parameters.search, parameters.page, parameters.pageSize || 6, parameters.searchOn, parameters.sortBy, {ID: currentUser.xp.favoriteProducts});
        }));
    });
    describe('Controller: FavoriteProductCtrl', function(){
        var favoriteProductCtrl;
        beforeEach(inject(function($state, $controller, CurrentUser){
            scope ={};
            scope.currentUser = CurrentUser;
            scope.product = {
                ID: 'productID'
            };
            favoriteProductCtrl = $controller('FavoriteProductCtrl', {
                $scope: scope,
                OrderCloud: oc,
                Underscore: underscore,
                toastr: toaster
            });

        }));
        describe('toggleFavoriteProduct', function(){
            beforeEach(function(){
                var defer = q.defer();
                defer.resolve();
                spyOn(oc.Me, 'Patch').and.returnValue(defer.promise);
                spyOn(underscore, 'without').and.returnValue('updatedList');
                spyOn(toaster, 'success');
            });
            it('should call the Me Patch method when deleting a product', function(){
                var updatedList = 'updatedList';
                favoriteProductCtrl.hasFavorites = true;
                favoriteProductCtrl.isFavorited = true;
                favoriteProductCtrl.toggleFavoriteProduct();
                expect(underscore.without).toHaveBeenCalled();
                expect(oc.Me.Patch).toHaveBeenCalledWith({xp: {FavoriteProducts: updatedList}});
            });
            it('should call the Me Patch method when removing a product', function(){
                var existingList = ['favoriteProduct', 'productID'];
                favoriteProductCtrl.hasFavorites = true;
                favoriteProductCtrl.isFavorited = false;
                favoriteProductCtrl.toggleFavoriteProduct();
                expect(oc.Me.Patch).toHaveBeenCalledWith({xp: {FavoriteProducts: existingList}});
            });
        });
    });
});