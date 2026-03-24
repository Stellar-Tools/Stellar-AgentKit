"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAllPagesRecursive = fetchAllPagesRecursive;
async function fetchAllPagesRecursive(fetchFunction, cursor, accumulatedData = []) {
    const result = await fetchFunction(cursor);
    const newAccumulatedData = accumulatedData.concat(result.data);
    if (result.hasNextPage && result.nextCursor) {
        return fetchAllPagesRecursive(fetchFunction, result.nextCursor, newAccumulatedData);
    }
    else {
        return newAccumulatedData;
    }
}
//# sourceMappingURL=paginated.js.map