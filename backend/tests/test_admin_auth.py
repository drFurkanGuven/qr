import unittest
from app.services.admin_auth import issue_token, verify_token


class TestAdminAuth(unittest.TestCase):
    def test_issue_and_verify_token(self):
        token = issue_token(ttl_seconds=3600)
        self.assertTrue(token.count(".") == 1)
        self.assertTrue(verify_token(token))

    def test_reject_unknown_token(self):
        self.assertFalse(verify_token("not.a-token"))

    def test_reject_tampered_token(self):
        token = issue_token()
        parts = token.split(".")
        tampered = f"{parts[0]}.{'0' * len(parts[1])}"
        self.assertFalse(verify_token(tampered))

    def test_reject_empty(self):
        self.assertFalse(verify_token(None))
        self.assertFalse(verify_token(""))


if __name__ == "__main__":
    unittest.main()