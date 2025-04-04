{ pkgs? import <nixpkgs> {} }:

let
  tree-sitter-web = pkgs.tree-sitter.override {
    webUISupport = true;
  };
in

pkgs.mkShell {
  buildInputs = [ tree-sitter-web ];
}
