export const LOCAL_HOST = "localhost";
export const MANAGER_PORT = 4_316;

export function localAddress(port: number): string {
  return `http://${LOCAL_HOST}:${port}`;
}

export const MANAGER_ADDRESS = localAddress(MANAGER_PORT);
