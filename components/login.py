import streamlit as st
import hashlib
import uuid
import streamlit.components.v1 as components

def login():
    st.title("Login")

    account_number = st.text_input("Enter your account number (hash):")

    if st.button("Login"):
        if validate_account_number(account_number):
            st.session_state["logged_in"] = True
            st.session_state["account_number"] = account_number
            st.experimental_rerun()
        else:
            st.error("Invalid account number. Please try again.")

    st.markdown("---")
    st.subheader("Don't have an account?")
    if st.button("Create Account"):
        create_account()

def validate_account_number(account_number):
    # Placeholder validation logic
    # In a real application, you would check the account number against a database or other data source
    return len(account_number) == 64 and all(c in "0123456789abcdef" for c in account_number)

def logout():
    st.session_state["logged_in"] = False
    st.session_state["account_number"] = None
    st.experimental_rerun()

def create_account():
    st.title("Create Account")

    # Automatically generate account number when the button is clicked
    account_number = generate_account_number()
    st.markdown("Your account number (hash) is:")
    st.markdown(f"```\n{account_number}\n```")
    st.write("Please save this account number securely. You will need it to log in.")
    st.button("Copy to Clipboard", on_click=copy_to_clipboard, args=(account_number,))

def generate_account_number():
    return hashlib.sha256(uuid.uuid4().bytes).hexdigest()

def copy_to_clipboard(account_number):
    # Inject JavaScript that copies the account number to the clipboard.
    components.html(
        f"""
        <script>
            navigator.clipboard.writeText("{account_number}")
                .then(() => {{
                    console.log('Copied to clipboard successfully!');
                }})
                .catch(err => {{
                    console.error('Failed to copy text: ', err);
                }});
        </script>
        """,
        height=0,  # Hide the component visually.
    )
    st.success("Account number copied to clipboard!")
