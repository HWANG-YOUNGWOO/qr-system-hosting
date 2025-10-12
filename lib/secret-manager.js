"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessSecretVersion = void 0;
const secret_manager_1 = require("@google-cloud/secret-manager");
// 예제: Secret Manager에서 시크릿 값을 읽는 유틸리티 함수
async function accessSecretVersion(secretName) {
    var _a, _b;
    const client = new secret_manager_1.SecretManagerServiceClient();
    // secretName 예: "projects/<PROJECT>/secrets/<SECRET_NAME>/versions/latest"
    const [version] = await client.accessSecretVersion({ name: secretName });
    const payload = (_b = (_a = version.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString();
    return payload || null;
}
exports.accessSecretVersion = accessSecretVersion;
// 사용 예시 (함수 안에서):
// const mySecret = await accessSecretVersion(`projects/${process.env.GCP_PROJECT}/secrets/MY_SECRET/versions/latest`);
//# sourceMappingURL=secret-manager.js.map