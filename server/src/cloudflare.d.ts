declare namespace Cloudflare {
  interface Env {
    BOARD: DurableObjectNamespace<import("./board-do").BoardDO>;
  }

  interface GlobalProps {
    mainModule: typeof import("./index");
    durableNamespaces: "BoardDO";
  }
}
