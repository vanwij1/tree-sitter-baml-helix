;; Comments
(comment) @comment.line
(doc_comment) @comment.documentation
(block_comment) @comment.block

;; Block keywords (class, enum, etc.)
(type_expression_block block_keyword: (identifier) @keyword.type)

;; Value expression keywords (function, test, client, etc.)
(value_expression_block keyword: (value_expression_keyword) @keyword.function)

;; Dynamic keyword
"dynamic" @keyword.modifier

;; Type and function names
(type_expression_block name: (identifier) @type)
(value_expression_block name: (identifier) @function)
(type_alias name: (identifier) @type)
(expr_fn name: (identifier) @function)
(template_declaration name: (identifier) @function)

;; Function calls
(fn_app function_name: (identifier) @function)

;; Class constructors
(class_constructor class_name: (identifier) @constructor)

;; Built-in types
(base_type (identifier) @type.builtin)
  ; (#match? @type.builtin "^(int|string|image|float|bool|double|map)$"))

;; Map types
(map_type) @type.builtin

;; Array notation
(array_notation) @type.builtin

;; Generic type parameters
(generic_type_params (identifier) @type.parameter)

;; Parameters and arguments
(named_argument name: (identifier) @variable.parameter)
(arguments_list) @punctuation.bracket
(named_argument_list) @punctuation.bracket

;; Type fields and expressions
(type_expression name: (identifier) @variable.member)
(class_field_value_pair field_name: (identifier) @variable.member)

;; Map entries
(map_entry key: (map_key) @variable.member)
(map_key (identifier) @variable.member)
(map_key (quoted_string_literal) @string.quoted.double)

;; Variables
(value_expression name: (identifier) @variable)
(let_expr name: (identifier) @variable)

;; Identifiers
(path_identifier) @variable.other
(namespaced_identifier) @variable.other

;; String literals
(quoted_string_literal) @string.quoted.double
(unquoted_string_literal) @string.unquoted
(raw_string_literal) @string.raw

;; Numeric literals
(numeric_literal) @constant.numeric

;; Jinja expressions
(jinja_expression) @markup.raw.inline

;; Attributes
(field_attribute "@" @attribute)
(field_attribute (identifier) @attribute)
(block_attribute "@@" @attribute)
(block_attribute (identifier) @attribute)

;; Error nodes
(ERROR) @error
