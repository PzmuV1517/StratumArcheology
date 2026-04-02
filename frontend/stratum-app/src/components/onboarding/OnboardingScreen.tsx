/**
 * @file
 * Onboarding screen component.
 *
 * Full-screen onboarding tutorial page with illustrations
 * and descriptive text.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React from "react";
import { Platform, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Onboarding from "@blazejkustra/react-native-onboarding";
import { useColorScheme } from "@/hooks/use-color-scheme";

/* ─────────────────────────────────────────────────────────────
 *  OnboardingScreen
 *
 *  Full-screen swiper onboarding using @blazejkustra/react-native-onboarding.
 *  Renders only on web. The library's image container has been patched
 *  (see scripts/patch-onboarding.sh) to use responsive sizing.
 * ────────────────────────────────────────────────────────────── */

interface Props {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingScreen: React.FC<Props> = ({
  visible,
  onComplete,
  onSkip,
}) => {
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const rootBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const titleColor = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const subtitleColor = isDarkMode ? "#999999" : "#5F5F5F";
  const stepPrimaryBg = isDarkMode ? "#111111" : "#FFFFFF";
  const stepSecondaryBg = isDarkMode ? "#1A1A1A" : "#F1F1F1";
  const stepLabelBg = isDarkMode ? "#2A2A2A" : "#E2E2E2";
  const stepTextPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const stepTextSecondary = isDarkMode ? "#999999" : "#5F5F5F";
  const stepTextContrast = "#FFFFFF";

  if (!visible || Platform.OS !== "web") return null;

  const introStyles = StyleSheet.create({
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: titleColor,
      textAlign: "center",
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: "400",
      color: subtitleColor,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 0,
    },
    button: {
      backgroundColor: "#FF2A2A",
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
      alignSelf: "center",
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
  });

  return (
    <View
      style={{
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99998,
        backgroundColor: rootBackground,
        ...(Platform.OS === "web" ? ({ position: "fixed" } as any) : {}),
      }}
    >
      <Onboarding
        introPanel={{
          title: <Text style={introStyles.title}>Welcome to STRATUM</Text>,
          subtitle: (
            <Text style={introStyles.subtitle}>
              Your all-in-one platform for archaeological excavation management.
              Let&apos;s take a quick tour!
            </Text>
          ),
          button: ({ onPressStart }) => (
            <TouchableOpacity
              style={introStyles.button}
              onPress={onPressStart}
              activeOpacity={0.8}
            >
              <Text style={introStyles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          ),
        }}
        steps={[
          {
            label: "Step 1",
            title: "Getting Started",
            description: "Let's get you all caught up with STRATUM.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/1ProjectsPage.png"),
            position: "top",
          },
          {
            label: "Step 2",
            title: "Create Projects",
            description:
              "Click on the + button to create a new project or join an existing one.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/2ClickNewProject.png"),
            position: "top",
          },
          {
            label: "Step 3",
            title: "New Project",
            description: "For now we'll make a new project.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/3NewProjectModal.png"),
            position: "top",
          },
          {
            label: "Step 4",
            title: "Creating the Project",
            description:
              "Fill in the project details and click 'Create Project'. Note that the description is optional but encouraged to help others understand the project.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/4CreateProject.png"),
            position: "top",
          },
          {
            label: "Step 5",
            title: "Project Overview",
            description:
              "Here you can see the number of notes and members of the project as well as the latest activity. You can click on the different tabs to view artefacts, notes, members, and more.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/5Overview.png"),
            position: "top",
          },
          {
            label: "Step 6",
            title: "Notes Tab",
            description:
              "Here you can see what notes have been added to the project. You can click on the 'Add Note' button to add a new note. Notes are a great way to keep track of your findings and observations during an excavation.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/6NoteTab.png"),
            position: "top",
          },
          {
            label: "Step 7",
            title: "Adding a Note",
            description:
              "You can add a title and the body of the note, just like any other note-taking app.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/7NewNote.png"),
            position: "top",
          },
          {
            label: "Step 8",
            title: "Adding a Voice Note",
            description:
              "Or you can switch to a voice note and record your observations hands-free while you work in the field and STRATUM will automatically transcribe it for you.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/8VoiceNote.png"),
            position: "top",
          },
          {
            label: "Step 9",
            title: "Adding an Artefact",
            description:
              "From the artefacts tab you can also add artefacts to your project. Click on the 'Add Artefact' button to add a new artefact. Here you can add a title, details about the artefact and upload photos and relevant files!",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/9NewArtefact.png"),
            position: "top",
          },
          {
            label: "Step 10",
            title: "Harris Matrix",
            description:
              "The Harris Matrix is a tool for representing the stratigraphic relationships between contexts in an archaeological excavation. You can view and edit the Harris Matrix from the 'Harris Matrix' tab.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/10HarrisMatrix.png"),
            position: "top",
          },
          {
            label: "Step 11",
            title: "New Harris Matrix Context",
            description:
              "Click anywhere on the Harris Matrix grid to add a new context.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/11HarrisNewContext.png"),
            position: "top",
          },
          {
            label: "Step 12",
            title: "Relations between Contexts",
            description:
              "Drag 2 context nodes onto each other to create a relation. You can then label the relation with the type of relation it is (e.g. 'above', 'below', 'same-phase', etc.)",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/12HarrisRelation.png"),
            position: "top",
          },
          {
            label: "Step 13",
            title: "More Menu",
            description:
              "The more menu contains additional options for your project. You can access it by clicking the three dots in the bottom right corner of the screen.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/13MoreModal.png"),
            position: "top",
          },
          {
            label: "Step 14",
            title: "Map",
            description: "The map view lets you define the bounds of your app.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/14Map.png"),
            position: "top",
          },
          {
            label: "Step 15",
            title: "Gallery",
            description:
              "The gallery view lets you view all the photos and media in your project in a nice and digestible way.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/15Gallery.png"),
            position: "top",
          },
          {
            label: "Step 16",
            title: "Time Machine",
            description:
              "The Time Machine lets you view files in your project at different points in time. Using this you can roll back any unwanted changes or just see how files evolved over time.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/16TimeMachine.png"),
            position: "top",
          },
          {
            label: "Step 17",
            title: "File Button",
            description: "The file button lets you access the file menu.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/17FileButton.png"),
            position: "top",
          },
          {
            label: "Step 18",
            title: "File Tab",
            description:
              "The file tab shows EVEYRY file in your project, even the normally hidden ones. You can view the files for the notes, the json of your artefacts and everything inbetween. You can also move and reagrange files in the database to fit your needs! This is for advanced users and it's encouraged to not modify the files in the LOCKED folders. If you know what you're doing go for it!",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/18FileModal.png"),
            position: "top",
          },
          {
            label: "Step 19",
            title: "Burger Menu",
            description:
              "The burger menu contains additional options for your project. You can access it by clicking the three lines in the top right corner of the screen.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/19BurgerModal.png"),
            position: "top",
          },
          {
            label: "Step 20",
            title: "Members Menu",
            description:
              "Click this to manage your project members. You can invite new members, remove existing ones, and if you're the project owner you can also transfer leadership or delete the project entirely.",
            buttonLabel: "Next",
            image: require("../../../assets/onboarding/20MembersMenu.png"),
            position: "top",
          },
          {
            label: "Step 21",
            title: "Inviting Members",
            description:
              "Change the type of invite you want to generate, permissions and for how long the invite should be valid for. Then click 'Generate Invite Link' and share the link or code with whoever you want to join your project!",
            buttonLabel: "Finish",
            image: require("../../../assets/onboarding/21GenerateInviteLink.png"),
            position: "top",
          },
          {
            label: "'The End?'",
            title: "You're All Set!",
            description:
              "You've completed the onboarding process. You're now ready to start using Stratum!",
            buttonLabel: "Finish",
            image: require("../../../assets/images/icon.png"),
            position: "top",
          },
        ]}
        onComplete={onComplete}
        onSkip={onSkip}
        showCloseButton={true}
        showBackButton={true}
        wrapInModalOnWeb={false}
        animationDuration={400}
        colors={{
          background: {
            primary: stepPrimaryBg,
            secondary: stepSecondaryBg,
            label: stepLabelBg,
            accent: "#FF2A2A",
          },
          text: {
            primary: stepTextPrimary,
            secondary: stepTextSecondary,
            contrast: stepTextContrast,
          },
        }}
      />
    </View>
  );
};
