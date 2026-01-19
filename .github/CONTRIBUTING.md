First of all, thanks for considering contributing to STRATUM! We welcome contributions from the community to help improve our app. Please take a moment to read through this guide to understand how to contribute effectively.

## How to Contribute

1. **Fork the Repository**: Start by forking the STRATUM repository to your own GitHub account.

2. **Clone Your Fork**: Clone your forked repository to your local machine using:
   ```
   git clone https://github.com/your-username/stratum.git
   ```

3. **Look for Issues**: Check the [Issues](https://github.com/PzmuV1517/QuantumBitsFLL2025-2026/issues) page for any open issues that you can work on. You can also propose new features or report bugs.

4. **Make virtual envirnment and install all dependencies**:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   cd backend
   pip install -r requirements.txt

   New terminal:
    cd frontend/stratum-app
    npm install
    npx expo install
   ```

5. **Configure Environment Variables**: Copy .env.example to .env (in both backend and frontend directories) and fill in the required environment variables.

6. **Create a New Branch**: Create a new branch for your feature or bug fix:
   ```
   git checkout -b feature/your-feature-name
   ```
7. **Make Your Changes**: Implement your changes in the codebase. Ensure your code follows the existing style and conventions.

8. **Test Your Changes**: Thoroughly test your changes to ensure they work as expected and do not introduce new issues.

9. **Commit Your Changes**: Commit your changes with a clear and descriptive commit message. Make sure to use Present Tense. For commit messages relates to backend and frontend, please prefix the message with [BACKEND] or [FRONTEND] respectively. For example:
    ```
    git add .
    git commit -m "[FRONTEND] Add new feature X"
    ```

10. **Push to Your Fork**: Push your changes to your forked repository:
    ```
    git push origin feature/your-feature-name
    ```

11. **Create a Pull Request**: Go to the original STRATUM repository and create a pull request from your forked repository. Follow the PR template and provide all necessary information about your changes.

