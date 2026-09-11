"""Manage staff accounts (stored in Backend/data/simrs.db).

Run from Backend/:
    python seed_users.py                              create the demo accounts if the database is empty, then list users
    python seed_users.py list                         list users
    python seed_users.py add <username> <role> "<full name>"   add an account (asks for the password)
    python seed_users.py passwd <username>            change a password (asks for it) and log that user out

Roles: admin, radiografer, radiolog, dokter_bedah
"""
import getpass
import sys

import auth


def ask_password():
    first = getpass.getpass("Password: ")
    if len(first) < 6:
        sys.exit("Password must be at least 6 characters.")
    if getpass.getpass("Repeat password: ") != first:
        sys.exit("Passwords do not match.")
    return first


def show():
    for u in auth.list_users():
        print(f"  {u['username']:14} {auth.ROLES.get(u['role'], u['role']):13} {u['full_name']}")


def main(argv):
    auth.init_db()
    if len(argv) <= 1 or argv[1] == "list":
        show()
    elif argv[1] == "add" and len(argv) == 5:
        auth.create_user(argv[2], ask_password(), argv[3], argv[4])
        print(f"Account '{argv[2]}' created.")
    elif argv[1] == "passwd" and len(argv) == 3:
        print("Password changed." if auth.set_password(argv[2], ask_password()) else f"No account '{argv[2]}'.")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
