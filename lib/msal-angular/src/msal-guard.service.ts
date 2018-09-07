import {Inject, Injectable} from "@angular/core";
import {
    ActivatedRoute,
    ActivatedRouteSnapshot, CanActivate, Router,
    RouterStateSnapshot,
} from "@angular/router";
import {MSAL_CONFIG, MsalService} from "./msal.service";
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/pairwise';
import {Location, PlatformLocation} from "@angular/common";
import {MsalConfig} from "./msal-config";
import {BroadcastService} from "./broadcast.service";
import {Constants} from "msal";
import {ErrorData} from "./errorData";
import {SuccessData} from "./successData";

@Injectable()
export class MsalGuard implements CanActivate {

    constructor(@Inject(MSAL_CONFIG) private config: MsalConfig, private authService: MsalService, private router: Router, private activatedRoute: ActivatedRoute, private location: Location, private platformLocation: PlatformLocation, private broadcastService: BroadcastService) {
    }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | Promise<boolean> {
        this.authService.getLogger().verbose("location change event from old url to new url");

        this.authService.updateDataFromCache([this.config.clientID]);
        if (!this.authService._oauthData.isAuthenticated && !this.authService._oauthData.userName) {
            if (state.url) {

                if (!this.authService._renewActive && !this.authService.loginInProgress()) {

                    var loginStartPage = this.getBaseUrl() + state.url;
                    if (loginStartPage !== null) {
                        this.authService.getCacheStorage().setItem(Constants.angularLoginRequest, loginStartPage);
                    }
                    if (this.config.popUp) {
                        return new Promise((resolve, reject) => {
                            this.authService.loginPopup(this.config.consentScopes, this.config.extraQueryParameters).then(function (token) {
                                resolve(true);
                            }, function (error) {
                                reject(false);
                            })
                        });
                    }
                    else {
                        this.authService.loginRedirect(this.config.consentScopes, this.config.extraQueryParameters);
                    }
                }
            }
        }
        //token is expired/deleted but userdata still exists in _oauthData object
        else if (!this.authService._oauthData.isAuthenticated && this.authService._oauthData.userName) {
            return new Promise((resolve, reject) => {
                this.authService.acquireTokenSilent([this.config.clientID]).then((token: any) => {
                    if (token) {
                        this.authService._oauthData.isAuthenticated = true;
                        const successData = new SuccessData(token ,"");
                        this.broadcastService.broadcast("msal:loginSuccess",  successData);
                        resolve (true);
                    }
                }, (error: any) => {
                    var errorParts = error.split('|');
                    const errorData = new ErrorData(errorParts[0], errorParts[1], "");
                    this.broadcastService.broadcast("msal:loginFailure", errorData);
                    resolve(false);
                });
            });
        }
        else {
            return true;
        }
    }

    private getBaseUrl(): String {
        var currentAbsoluteUrl = window.location.href;
        var currentRelativeUrl = this.location.path();
        if (this.isEmpty(currentRelativeUrl)) {
            if (currentAbsoluteUrl.endsWith("/")) {
                currentAbsoluteUrl = currentAbsoluteUrl.replace(/\/$/, '');
            }
            return currentAbsoluteUrl;
        }
        else {
            var index = currentAbsoluteUrl.indexOf(currentRelativeUrl);
            return currentAbsoluteUrl.substring(0, index);
        }
    }

    isEmpty = function (str: any) {
        return (typeof str === "undefined" || !str || 0 === str.length);
    };

}
