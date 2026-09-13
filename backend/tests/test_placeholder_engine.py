import unittest
import json
from app.services.placeholder_engine import PlaceholderEngine


class TestPlaceholderEngine(unittest.TestCase):
    def test_builtin_placeholders(self):
        input_qr = "SAMPLE_QR_9988"
        text = '{"code": "{{qr_data}}", "time": "{{timestamp}}", "id": "{{uuid}}"}'
        resolved = PlaceholderEngine.resolve_text(text, input_qr)

        self.assertIn("SAMPLE_QR_9988", resolved)
        self.assertNotIn("{{qr_data}}", resolved)
        self.assertNotIn("{{timestamp}}", resolved)
        self.assertNotIn("{{uuid}}", resolved)

        # Parse as json
        parsed = json.loads(resolved)
        self.assertEqual(parsed["code"], "SAMPLE_QR_9988")
        self.assertTrue(parsed["time"].isdigit())

    def test_custom_variables(self):
        input_val = "MY_DATA"
        text = "https://api.test.com/v1/{{custom_endpoint}}?token={{auth_token}}&data={{qr_data}}"
        custom_vars = {"custom_endpoint": "verify", "auth_token": "secret_abc"}
        resolved = PlaceholderEngine.resolve_text(text, input_val, custom_vars)

        self.assertEqual(
            resolved,
            "https://api.test.com/v1/verify?token=secret_abc&data=MY_DATA"
        )

    def test_random_int(self):
        text = "Order-{{random_int:100:999}}"
        resolved = PlaceholderEngine.resolve_text(text, "test")
        self.assertTrue(resolved.startswith("Order-"))
        num = int(resolved.replace("Order-", ""))
        self.assertGreaterEqual(num, 100)
        self.assertLessEqual(num, 999)

    def test_resolve_template(self):
        url = "https://service.local/scan/{{qr_data}}"
        headers = {"X-Trace-Id": "{{uuid}}", "Authorization": "Bearer {{auth_token}}"}
        body = '{"scanned": "{{qr_data}}"}'
        params = {"device": "scanner-1"}

        res_url, res_headers, res_body, res_params = PlaceholderEngine.resolve_template(
            url=url,
            method="POST",
            headers=headers,
            body=body,
            query_params=params,
            input_value="QR_42",
            custom_vars={"auth_token": "token_xyz"},
        )

        self.assertEqual(res_url, "https://service.local/scan/QR_42")
        self.assertEqual(res_headers["Authorization"], "Bearer token_xyz")
        self.assertIn("QR_42", res_body)
        self.assertEqual(res_params["device"], "scanner-1")
        parsed_body = json.loads(res_body)
        self.assertEqual(parsed_body["qr_token"], "QR_42")
        self.assertEqual(parsed_body["scanned"], "QR_42")

    def test_qr_token_alias_and_empty_body(self):
        resolved = PlaceholderEngine.resolve_text('{"qr_token":"{{qr_token}}"}', "LAB_TOKEN_1")
        self.assertEqual(json.loads(resolved)["qr_token"], "LAB_TOKEN_1")

        injected = PlaceholderEngine.inject_qr_token_into_body(None, "LAB_TOKEN_2")
        self.assertEqual(json.loads(injected)["qr_token"], "LAB_TOKEN_2")

        merged = PlaceholderEngine.inject_qr_token_into_body(
            '{"event":"verify"}', "LAB_TOKEN_3"
        )
        self.assertEqual(json.loads(merged)["event"], "verify")
        self.assertEqual(json.loads(merged)["qr_token"], "LAB_TOKEN_3")


if __name__ == "__main__":
    unittest.main()
