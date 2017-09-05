import {
    drop,
    every,
    first,
    has,
    map,
    reverse,
} from "lodash";

import FetchyMiddleware, {
    IFetchParams,
    IFetchyChain,
    IFetchyMiddleware,
    IFetchyMiddlewareDeclaration,
} from "./middlewares/base";

import {
    getRetryMiddlewareDeclaration,
    IFetchyRetryMiddlewareConfig,
} from "./middlewares/retry";

import FetchFakeMiddleware from "./middlewares/fetch";

export interface IFetchyConfig {
    middlewares: IFetchyMiddlewareDeclaration[];
    retry: IFetchyRetryMiddlewareConfig | boolean;
}

export function validateMiddlewareDeclarations(middlewares: IFetchyMiddlewareDeclaration[]): boolean {

    return every(map(middlewares, (middlewareDeclaration: IFetchyMiddlewareDeclaration) =>

        has(middlewareDeclaration, "class")
            && has(middlewareDeclaration, "config")
            && middlewareDeclaration.class instanceof FetchyMiddleware,
            // && middlewareDeclaration.config @TODO complete me!

    ));

}

function validateFetchyConfig(fetchyConfig: IFetchyConfig): boolean {

    if (!has(fetchyConfig, "middlewares")) {
        throw new TypeError("fetchyConfig has no property 'middlewares'");
    }

    return validateMiddlewareDeclarations(fetchyConfig.middlewares);

}

function instanceFetchyMiddleware(
    middlewareClass,
    middlewareConfig,
    nextRing,
): IFetchyMiddleware {

    if (nextRing === null) {
        nextRing = new FetchFakeMiddleware({}, null);
    }

    return new middlewareClass(
        middlewareConfig,
        nextRing,
    );

}

function buildChainRings(
    middlewareDeclaration: IFetchyMiddlewareDeclaration,
    nextRing: IFetchyMiddleware,
    remainingMiddlewareDeclarations: IFetchyMiddlewareDeclaration[],
): IFetchyMiddleware {

    const ring = instanceFetchyMiddleware(
        middlewareDeclaration.class,
        middlewareDeclaration.config,
        nextRing,
    );

    if (remainingMiddlewareDeclarations.length > 0) {
        return buildChainRings(
            first(remainingMiddlewareDeclarations),
            ring,
            drop(remainingMiddlewareDeclarations, 1),
        );
    }

    return ring;

}

export function buildChain(fetchyConfig: IFetchyConfig): IFetchyChain {

    validateFetchyConfig(fetchyConfig);

    const middlewareDeclarations = fetchyConfig.middlewares;
    const retryMiddlewareDeclaration = getRetryMiddlewareDeclaration(fetchyConfig.retry);
    if (retryMiddlewareDeclaration !== null) {
        middlewareDeclarations.push(retryMiddlewareDeclaration);
    }
    const reversedMiddlewareDeclarations = reverse(middlewareDeclarations);

    return {
        start: buildChainRings(
            first(reversedMiddlewareDeclarations),
            null,
            drop(reversedMiddlewareDeclarations),
        ),
    };

}

export function executeChain(chain: IFetchyChain, fetchParams: IFetchParams): Promise<Response> {
    return chain.start.processRequest(fetchParams, null);
}
