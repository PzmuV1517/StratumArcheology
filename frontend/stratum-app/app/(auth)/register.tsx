/**
 * @file
 * Registration screen.
 *
 * New user registration form with email, password, and
 * display name fields.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { Redirect } from "expo-router";

export default function RegisterScreen() {
  return <Redirect href="/(auth)/login" />;
}
