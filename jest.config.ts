import type { Config } from "jest";

const config: Config = {
  displayName: "hdp-portal",
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  moduleDirectories: ["node_modules", "<rootDir>"],
  collectCoverageFrom: [
    "lib/**/*.ts",
    "app/api/**/*.ts",
    "components/**/*.tsx",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/.next/**",
  ],
  // Coverage thresholds disabled for initial testing phase
  // Will be enabled progressively as test coverage improves
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
};

export default config;
