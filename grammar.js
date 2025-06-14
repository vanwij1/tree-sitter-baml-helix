// Helper function for comma-separated lists (optional, Tree-sitter often includes similar)
const sepBy1 = (sep, rule) => seq(rule, repeat(seq(sep, rule)));
const sepBy = (sep, rule) => optional(sepBy1(sep, rule));

module.exports = grammar({
  name: 'baml',

  // Whitespace and comments generally ignored between tokens
  extras: $ => [
    /\s/, // Includes space, tab, newline. Newlines might need explicit handling if significant.
    $.comment,
    $.doc_comment,
    $.block_comment,
  ],

  conflicts: $ => [
    [$.map_expression, $._BLOCK_OPEN],
    [$.field_type_with_attr, $.group_type],
    [$.tuple_type, $.parenthesized_type],
    [$.fn_app, $._expression],
    [$.class_constructor, $._expression]
  ],

  // External scanner for complex tokens like raw strings (optional but recommended)
  // externals: $ => [
  //   $._raw_string_literal_content // Example if using external scanner
  // ],

  supertypes: $ => [
    $._expression,
    $._type,
    $._top_level_item,
    // $._value_or_type_expression,
    $._string_literal,
  ],

  // Potential conflicts to resolve if ambiguities arise during testing
  // conflicts: $ => [
  //   [$.identifier, $.field_type], // Example
  // ],

  word: $ => $._single_word, // Define base identifier for potential keyword conflicts

  rules: {
    // Entry Point (schema equivalent)
    source_file: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
        $.expr_fn,
        $.top_level_assignment,
        $.value_expression_block,
        $.type_expression_block,
        $.template_declaration,
        $.type_alias,
        // $.comment_block, // Handled by extras
        $.raw_string_literal, // PEST allows this at top level
        // $.empty_lines, // Implicitly handled by extras containing \s (includes newline)
        // CATCH_ALL omitted, rely on error recovery
    ),

    // ######################################
    // Type Blocks (Class/Enum)
    // ######################################
    type_expression_block: $ => seq(
      field('block_keyword', $.identifier), // e.g., 'class', 'enum'
      field('name', $.identifier),
      field('args', optional($.named_argument_list)),
      $._BLOCK_OPEN,
      field('body', optional($.type_expression_contents)),
      $._BLOCK_CLOSE
    ),

    dynamic_type_expression_block: $ => seq(
      'dynamic', // Assuming 'dynamic' is the identifier keyword here based on description
      $.type_expression_block
    ),

    type_expression_contents: $ => repeat1(choice(
      $.type_expression,
      $.block_attribute,
      // $.comment_block, // extras
      // $.empty_lines, // extras
      // BLOCK_LEVEL_CATCH_ALL omitted
    )),

    type_expression: $ => prec.left(seq(
      field('name', $.identifier),
      field('type', optional($.field_type_chain)),
      // Optional newline/attributes/comments handled by structure/extras
      repeat(choice($.field_attribute, $.trailing_comment)), // Simplified PEST's nested optional/repeat
    )),

    _field_operator: $ => '|',

    field_type_chain: $ => sepBy1($._field_operator, $.field_type_with_attr),

    field_type_with_attr: $ => prec.left(seq(
      $.field_type,
      // Optional newline/attributes/comments handled by structure/extras
      repeat(choice($.field_attribute, $.trailing_comment)), // Simplified
    )),

    // ######################################
    // Value Blocks (Function, Test, Client, etc.)
    // ######################################
    value_expression_keyword: $ => choice(
      $._FUNCTION_KEYWORD,
      $._TEST_KEYWORD,
      $._CLIENT_KEYWORD,
      $._RETRY_POLICY_KEYWORD,
      $._GENERATOR_KEYWORD
    ),

    value_expression_block: $ => seq(
      field('keyword', $.value_expression_keyword),
      field('name', $.identifier),
      field('args', optional($.named_argument_list)),
      field('return_type', optional(seq($._ARROW, $.field_type_chain))),
      // SPACER_TEXT omitted (handled by extras)
      $._BLOCK_OPEN,
      field('body', optional($.value_expression_contents)),
      $._BLOCK_CLOSE
    ),

    value_expression_contents: $ => repeat1(choice(
      $.type_builder_block,
      $.value_expression,
      $.block_attribute,
      // $.comment_block, // extras
      // $.empty_lines, // extras
      // BLOCK_LEVEL_CATCH_ALL omitted
    )),

    value_expression: $ => prec.left(seq(
      field('name', $.identifier),
      field('value', optional($._expression)), // Maps to PEST 'expression?'
      repeat($.field_attribute),
      optional($.trailing_comment),
    )),

    // ######################################
    // Type builder
    // ######################################
    type_builder_block: $ => seq(
      $._TYPE_BUILDER_KEYWORD,
      $._BLOCK_OPEN,
      field('body', optional($.type_builder_contents)),
      $._BLOCK_CLOSE
    ),

    type_builder_contents: $ => repeat1(choice(
        $.dynamic_type_expression_block,
        $.type_expression_block,
        $.type_alias,
        // $.comment_block, // extras
        // $.empty_lines, // extras
        // BLOCK_LEVEL_CATCH_ALL omitted
    )),

    // ######################################
    // Template Declaration
    // ######################################
    _assignment: $ => '=',

    template_declaration: $ => seq(
      $._TEMPLATE_KEYWORD,
      field('name', $.identifier),
      optional($._assignment), // PEST has assignment? here, seems unusual with args?
      optional(field('args', $.named_argument_list)),
      field('value', $.raw_string_literal)
    ),

    // ######################################
    // Named Arguments
    // ######################################
    _colon: $ => ':',

    named_argument: $ => seq(
        field('name', $.identifier),
        optional(seq($._colon, field('type', $.field_type_chain)))
    ),

    named_argument_list: $ => seq(
      $._openParan,
      // SPACER_TEXT omitted (extras)
      optional(sepBy($._COMMA, $.named_argument)),
      optional($._COMMA), // Trailing comma
      // SPACER_TEXT omitted (extras)
      $._closeParan
    ),

    // ######################################
    // Attributes
    // ######################################
    block_attribute: $ => seq('@@', $.identifier, optional($.arguments_list)),
    field_attribute: $ => seq('@', $.identifier, optional($.arguments_list)),

    // ######################################
    // Types
    // ######################################
    _optional_token: $ => '?',

    field_type: $ => seq(
      // choice($.union_type, $.non_union_type), // PEST order matters; TS choice handles this
      $._type,
      optional($._optional_token)
    ),

    _type: $ => choice(
        $.union_type, // Needs higher precedence if overlapping with base_type
        $.array_notation,
        $.map_type,
        $.identifier,
        $.group_type,
        $.tuple_type,
        $.parenthesized_type, // Added based on base_type definition
        $.literal_type
    ),

    union_type: $ => prec.left(1, sepBy1($._field_operator, $.base_type_with_attr)), // Use prec.left for chaining

    literal_type: $ => choice($.numeric_literal, $.quoted_string_literal),

    base_type_with_attr: $ => prec.left(seq(
        $.base_type,
        repeat($.field_attribute) // Simplified newline/attribute handling
    )),

    base_type: $ => prec(1, choice(
      $.array_notation, // Defined below, refers back to base_type_without_array
      $.map_type,
      $.identifier,
      $.group_type,
      $.tuple_type,
      $.parenthesized_type, // Added this choice
      $.literal_type
    )),

    _array_suffix: $ => seq('[', ']'),

    // Need to break recursion carefully
    array_notation: $ => prec.right(seq(
      $._base_type_without_array, // Use internal rule
      repeat1($._array_suffix),
      optional($._optional_token) // Optional applies to the whole array type
    )),

    map_type: $ => prec.left(seq(
      'map', '<', field('key_type', $.field_type), $._COMMA, field('value_type', $.field_type), '>',
      optional($._optional_token)
    )),

    group_type: $ => seq($._openParan, $.field_type, repeat($.field_attribute), $._closeParan), // PEST 'group' rule

    tuple_type: $ => seq( // PEST 'tuple' rule
      $._openParan,
      sepBy1($._COMMA, $.field_type_with_attr), // Must have at least two elements for tuple
      $._closeParan
    ),

    // Explicitly define base types excluding array notation to avoid left-recursion in array_notation rule
    _base_type_without_array: $ => choice(
        $.map_type,
        $.identifier,
        $.group_type,
        $.tuple_type,
        $.parenthesized_type, // Was missing here?
        $.literal_type // Was missing here? Check PEST logic carefully
    ),

    // // non_union seems redundant if _type captures all alternatives correctly
    // non_union_type: $ => choice(
    //   $.array_notation,
    //   $.map_type,
    //   $.identifier,
    //   $.group_type,
    //   $.tuple_type,
    //   $.literal_type
    // ),

    parenthesized_type: $ => seq($._openParan, $.field_type_with_attr, $._closeParan),

    // ######################################
    // Identifiers
    // ######################################
    identifier: $ => choice(
        $.path_identifier,
        $.namespaced_identifier,
        $._single_word // Base identifier token
    ),
    // Use higher precedence for longer matches
    path_identifier: $ => prec(2, seq($._single_word, repeat1(seq('.', $._single_word)))),
    namespaced_identifier: $ => prec(1, seq($._single_word, repeat1(seq('::', $._single_word)))),
    // Token for a basic identifier part
    _single_word: $ => /[a-zA-Z][a-zA-Z0-9_-]*/,

    // ######################################
    // Type Alias
    // ######################################
    type_alias: $ => seq(
      'type', // Assuming 'type' is the keyword based on PEST identifier identifier = ...
      field('name', $.identifier),
      $._assignment,
      field('target', $.field_type_with_attr)
    ),

    // ######################################
    // Arguments (for attributes)
    // ######################################
    arguments_list: $ => seq(
      '(',
      // Optional newlines handled by extras
      optional(sepBy($._COMMA, $._expression)), // Allow zero args
      // Optional newlines handled by extras
      ')'
    ),

    // ######################################
    // Expressions & Functions
    // ######################################
    _expression: $ => choice(
      $.fn_app,
      $.lambda,
      prec(1, $.expr_block), // Added this choice
      prec(2, $.map_expression),
      $.jinja_expression,
      $.array_expression,
      $.numeric_literal,
      $.class_constructor, // Added this choice
      $.string_literal,
      $.identifier
      // Add other expression types if necessary
    ),

    map_key: $ => choice($.identifier, $.quoted_string_literal),

    map_entry: $ => seq(
      // comment_block / empty_lines handled by extras
      field('key', $.map_key),
      optional(field('value', $._expression)), // PEST has (expression | ENTRY_CATCH_ALL)?
      optional($.trailing_comment)
      // ENTRY_CATCH_ALL omitted
    ),

    // Define splitter explicitly if newlines are significant separators here
    _splitter: $ => choice(seq($._COMMA /* optional($._NEWLINE) */), $._NEWLINE), // Using token for newline

    map_expression: $ => seq(
      '{',
      // empty_lines handled by extras
      optional(sepBy($._splitter, $.map_entry)), // Uses explicit splitter
      // comment_block / empty_lines handled by extras
      '}'
    ),

    array_expression: $ => seq(
      '[',
      // empty_lines handled by extras
      optional(sepBy($._splitter, choice($._expression /*, $.ARRAY_CATCH_ALL */))), // Uses explicit splitter
      // comment_block / empty_lines handled by extras
      optional($._splitter), // PEST has splitter? at the end
      ']'
      // ARRAY_CATCH_ALL omitted
    ),

    _jinja_block_open: $ => prec(1,seq('{','{')),
    _jinja_block_close: $ => prec(1,seq('}','}')),
    // _jinja_body: $ => token(prec(-1, /.*?/)), // Very permissive, adjust regex as needed
    _jinja_body: $ => token(prec(-1, /[^}]*([^}][^}]*?)*/)),

    jinja_expression: $ => seq(
        $._jinja_block_open,
        $._jinja_body, // Needs careful definition
        $._jinja_block_close
    ),

    // ######################################
    // Literals / Values
    // ######################################
    numeric_literal: $ => token(/-?\d+(\.\d+)?/),

    // ######################################
    // String literals
    // ######################################
    string_literal: $ => $._string_literal, // Supertype

    _string_literal: $ => choice(
      $.raw_string_literal,
      $.quoted_string_literal,
      $.unquoted_string_literal // This is tricky, often leads to ambiguities
      // $.unterminated_string_literal // Handled by error recovery usually
    ),

    // PEST unquoted is complex: (!banned_start_chars ~ ANY) ~ (!banned_chars ~ !"\"" ~ ANY)* ~ (!banned_end_chars ~ ANY)*
    // This is very hard to represent reliably without lookahead/lookbehind or complex state,
    // often requires external scanner or very careful regex. Let's try a simplified regex.
    // WARNING: This unquoted literal might be ambiguous or overly greedy.
    unquoted_string_literal: $ => token(prec(-1, // Use lower precedence
        // Start char: not whitespace, not banned symbols
        // Subsequent chars: not newline, not banned symbols, not quote
        /[^\s#@{}()\[\]<>,';][^\n\r#@{}()\[\]<>,';"]*/
    )),

    // Based on PEST: "\"" ~ quoted_string_content ~ "\""
    // quoted_string_content = @{ (("\\\"" | !("\"" | NEWLINE) ~ ANY))* }
    quoted_string_literal: $ => token(seq('"', /(\\"|[^"\n])*/, '"')),

    // Raw strings need careful tokenization. Using simplified regexes.
    // An external scanner is often better for complex delimited tokens.
    raw_string_literal: $ => token(choice(
        // Format: optional_prefix delimiter content delimiter
        // Using non-greedy .*? for content - adjust if specific exclusion needed
        /(?:[a-zA-Z][a-zA-Z0-9_-]*)?#####"[\s\S]*?"#####/,
        /(?:[a-zA-Z][a-zA-Z0-9_-]*)?####"[\s\S]*?"####/,
        /(?:[a-zA-Z][a-zA-Z0-9_-]*)?###"[\s\S]*?"###/,
        /(?:[a-zA-Z][a-zA-Z0-9_-]*)?##"[\s\S]*?"##/,
        /(?:[a-zA-Z][a-zA-Z0-9_-]*)?#"[\s\S]*?"#/
    )),

    // Unterminated literals are typically parse errors handled by Tree-sitter

    // ######################################
    // Comments (defined as tokens for extras)
    // ######################################
    // comment_block handled by repetition in extras
    trailing_comment: $ => choice($.doc_comment, $.comment), // Use within rules if needed specifically

    doc_comment: $ => token(seq('///', /[^\n]*/)),
    comment: $ => token(seq('//', /[^\n]*/)), // Simplified PEST: WHITESPACE* ~ (!"///") ~ "//" ~ doc_content
    block_comment: $ => token(seq('{//', /(\/\/}|[^\}])*/, '//}')), // PEST: "{//" ~ block_content ~ "//}" block_content = @{ (!"//}" ~ ANY)* }

    // ######################################
    // Shared Building Blocks
    // ######################################
    // WHITESPACE handled by extras: /\s/
    _NEWLINE: $ => token(/\n|\r\n|\r/), // Explicit newline token if needed separate from general whitespace
    // empty_lines handled by extras containing \s which includes newlines

    // SPACER_TEXT is implicitly handled by extras

    _ARROW: $ => '->',
    _BLOCK_OPEN: $ => '{',
    _BLOCK_CLOSE: $ => '}',
    _openParan: $ => '(',
    _closeParan: $ => ')',
    _SEMICOLON: $ => ';',
    // _COLON: $ => ':', // Defined above
    _COMMA: $ => ',',

    // ######################################
    // Keywords (as tokens for clarity and potential conflict resolution)
    // ######################################
    _FUNCTION_KEYWORD: $ => 'function',
    _TEMPLATE_KEYWORD: $ => choice('template_string', 'string_template'),
    _TEST_KEYWORD: $ => 'test',
    _TYPE_BUILDER_KEYWORD: $ => 'type_builder',
    // PEST client<llm> is tricky. If '<llm>' is optional or fixed, adjust.
    // Assuming fixed for now or just 'client'. Requires clarification.
    _CLIENT_KEYWORD: $ => choice('client<llm>', 'client'),
    _GENERATOR_KEYWORD: $ => 'generator',
    _RETRY_POLICY_KEYWORD: $ => 'retry_policy',

    // #################################################
    // BAML Expressions (New section from PEST)
    // #################################################

    top_level_assignment: $ => alias($.stmt, $.assignment_statement), // Alias for clarity

    expr_fn: $ => seq(
      'fn',
      field('name', $.identifier),
      field('params', $.named_argument_list), // PEST uses named_argument_list
      field('return_type', optional(seq($._ARROW, $.field_type_chain))),
      field('body', $.expr_block)
    ),

    expr_block: $ => seq(
      $._BLOCK_OPEN,
      // Optional newline handled by extras
      repeat($.stmt), // PEST: (stmt ~ NEWLINE)*
      field('return_value', $._expression), // PEST: expression
      // Optional newline handled by extras
      $._BLOCK_CLOSE
    ),

    stmt: $ => seq($.let_expr, optional($._SEMICOLON)),

    let_expr: $ => seq(
      'let',
      field('name', $.identifier),
      $._assignment, // PEST uses '='
      field('value', $._expression)
    ),

    fn_app: $ => seq(
      field('function_name', $.identifier),
      '(',
      optional(sepBy($._COMMA, $._expression)),
      ')'
    ),

    lambda: $ => seq(
        field('params', $.named_argument_list), // PEST uses named_argument_list
        '=>', // PEST uses =>
        field('body', $._expression)
    ),

    class_constructor: $ => seq(
      field('class_name', $.identifier), // Assuming identifier is the class name
      '{',
      // Optional newline handled by extras
      optional(sepBy($._COMMA, $.class_field_value_pair)), // PEST: (pair ~ COMMA? ~ NEWLINE?)*
      optional($._COMMA), // Allow trailing comma
      // Optional newline handled by extras
      '}'
    ),

    class_field_value_pair: $ => choice(
        seq(field('field_name', $.identifier), $._colon, field('value', $._expression)),
        $.struct_spread
    ),

    struct_spread: $ => seq('..', $._expression),

  } // end rules
}); // end grammar

