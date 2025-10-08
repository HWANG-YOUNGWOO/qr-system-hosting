import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// 예제: Secret Manager에서 시크릿 값을 읽는 유틸리티 함수
export async function accessSecretVersion(secretName: string) {
  const client = new SecretManagerServiceClient();
  // secretName 예: "projects/<PROJECT>/secrets/<SECRET_NAME>/versions/latest"
  const [version] = await client.accessSecretVersion({ name: secretName });
  const payload = version.payload?.data?.toString();
  return payload || null;
}

// 사용 예시 (함수 안에서):
// const mySecret = await accessSecretVersion(`projects/${process.env.GCP_PROJECT}/secrets/MY_SECRET/versions/latest`);
