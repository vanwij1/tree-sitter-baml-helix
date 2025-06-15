# Installation (together with LSP)

## Add to language.toml 

```[[toml]]
name = "baml"
scope = "text.baml"
file-types = ["baml"]
shebangs = []
roots = []
auto-format = false
comment-tokens = "//"
language-servers = ["baml-lsp"]

[language-server.baml-lsp]
command = "baml-cli"
args = ["lsp"]

[[grammar]]
name = "baml"
source = { git = "https://github.com/vanwij1/tree-sitter-baml-helix", rev = "b22791645d3bbbe63ca5c48317073e0af181c37e" }
```
--> Change the rev to latest commit hash

### Feth and build
```
> hx -g fetch
> hx -f build
```

### Highlights

Copy the queries/highlights.scm file to your .config/helix/runtime/queries/baml/highlights.scm


# TODO:

- Jinja expression (not variables don't work yet)
  - In a block comment things like class and comment are parsed (not allowed)
    - maybe we have to write a scanner for this