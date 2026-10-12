import unittest


class CsvUploadParserTests(unittest.TestCase):
    def parse(self, content, delimiter='auto', has_headers=True, preview_limit=50):
        from app.application.uploads import CsvOptions
        from app.infrastructure.csv_parser import CsvSourceParser
        source = content.encode('utf-8') if isinstance(content, str) else content
        return CsvSourceParser().parse(source, CsvOptions(delimiter, has_headers), preview_limit)

    def assert_invalid(self, content, text, **kwargs):
        from app.application.errors import ValidationError
        with self.assertRaises(ValidationError) as caught:
            self.parse(content, **kwargs)
        self.assertIn(text, ' '.join(caught.exception.details))

    def test_arbitrary_duplicate_blank_headers_and_whitespace_preserved(self):
        preview = self.parse('\ufeff Product ,Product,, Notes \r\n value ,second,, exact spaces \r\n', delimiter=',')
        self.assertEqual(preview.headers, [' Product ', 'Product', '', ' Notes '])
        self.assertEqual(preview.rows, [[' value ', 'second', '', ' exact spaces ']])
        self.assertEqual((preview.row_count, preview.column_count), (1, 4))
        self.assertTrue(preview.warnings)

    def test_headerless_first_row_is_data(self):
        preview = self.parse('A,B\nC,D\n', has_headers=False)
        self.assertIsNone(preview.headers)
        self.assertEqual(preview.rows, [['A', 'B'], ['C', 'D']])
        self.assertEqual(preview.row_count, 2)

    def test_blank_and_ragged_records_stay_positional(self):
        preview = self.parse('A,B\n\n1\n2,3,4\n , \n', delimiter=',')
        self.assertEqual(preview.rows, [[], ['1'], ['2', '3', '4'], [' ', ' ']])
        self.assertEqual((preview.row_count, preview.column_count), (4, 3))
        self.assertTrue(any('column' in warning.lower() for warning in preview.warnings))

    def test_leading_blank_record_is_not_automatically_skipped(self):
        preview = self.parse('\nA,B\n', delimiter=',')
        self.assertEqual(preview.headers, [])
        self.assertEqual(preview.rows, [['A', 'B']])

    def test_all_supported_delimiters_and_quoted_delimiters(self):
        for delimiter in [',', ';', '\t']:
            with self.subTest(delimiter=delimiter):
                preview = self.parse(f'A{delimiter}B\n"left{delimiter}right"{delimiter}value\n')
                self.assertEqual(preview.delimiter, delimiter)
                self.assertEqual(preview.rows, [[f'left{delimiter}right', 'value']])
                self.assertEqual(preview.requested_delimiter, 'auto')

    def test_explicit_override_is_used_even_when_auto_would_choose_differently(self):
        preview = self.parse('A;B,C\n1;2,3\n', delimiter=';')
        self.assertEqual(preview.headers, ['A', 'B,C'])
        self.assertEqual(preview.rows, [['1', '2,3']])
        self.assertEqual(preview.requested_delimiter, ';')

    def test_correct_override_recovers_from_wrong_delimiter_failure(self):
        content = 'A;B\n"left,right";value\n'
        self.assert_invalid(content, 'delimiter', delimiter=',')
        self.assertEqual(self.parse(content, delimiter=';').rows, [['left,right', 'value']])

    def test_ambiguous_automatic_detection_warns(self):
        preview = self.parse('A;B,C\n1;2,3\n')
        self.assertTrue(any('ambiguous' in warning.lower() for warning in preview.warnings))

    def test_single_column_and_headers_only_are_valid(self):
        preview = self.parse('Original label\n')
        self.assertEqual(preview.headers, ['Original label'])
        self.assertEqual(preview.row_count, 0)
        self.assertEqual(preview.column_count, 1)

    def test_quoted_newlines_and_escaped_quotes_preserved(self):
        preview = self.parse('A,B\n"First\r\nSecond","a ""quote"""\n', delimiter=',')
        self.assertEqual(preview.rows, [['First\r\nSecond', 'a "quote"']])

    def test_empty_whitespace_invalid_encoding_and_binary_controls_rejected(self):
        for content in [b'', b' \n\t\r', b'\xef\xbb\xbf\n', b',,\n,,\n', b'""\n', b'\xff\xfeA\x00', b'A,B\n1,\x00\n', b'A,B\n1,\x01\n']:
            with self.subTest(content=repr(content)):
                from app.application.errors import ValidationError
                with self.assertRaises(ValidationError):
                    self.parse(content)

    def test_malformed_quoting_has_actionable_error(self):
        for content in ['A,B\n1,"unfinished', 'A,B\n1,bad"quote\n', 'A,B\n1,"closed"junk\n']:
            with self.subTest(content=content):
                self.assert_invalid(content, 'quot', delimiter=',')

    def test_entire_file_is_validated_after_preview_limit(self):
        self.assert_invalid('A,B\n' + '1,2\n' * 60 + '3,"unfinished', 'quot', preview_limit=2, delimiter=',')

    def test_preview_truncates_without_old_row_limit(self):
        preview = self.parse('A,B\n' + '1,2\n' * 1001, preview_limit=2)
        self.assertEqual(preview.rows, [['1', '2'], ['1', '2']])
        self.assertEqual(preview.row_count, 1001)
        self.assertTrue(preview.truncated)

    def test_full_file_column_count_includes_non_previewed_row(self):
        preview = self.parse('A,B\n1,2\n3,4,5,6\n', preview_limit=1, delimiter=',')
        self.assertEqual(preview.rows, [['1', '2']])
        self.assertEqual(preview.column_count, 4)
        self.assertTrue(preview.warnings)

    def test_large_valid_field_is_preserved(self):
        value = 'A' * 200000
        self.assertEqual(self.parse('Header\n' + value + '\n').rows, [[value]])
