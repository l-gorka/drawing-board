declare namespace Cloudflare {
  interface Env {
    BOARD: DurableObjectNamespace<import("./board-do").BoardDO>;
    BOARD_CATALOG: DurableObjectNamespace<
      import("./board-catalog-do").BoardCatalogDO
    >;
  }

  interface GlobalProps {
    mainModule: typeof import("./index");
    durableNamespaces: "BoardDO" | "BoardCatalogDO";
  }
}
