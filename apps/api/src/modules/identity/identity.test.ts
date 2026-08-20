import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  AuthenticationIdentity,
  CadencePerson,
  OrganisationalAffiliation,
} from "./identity.types";

import {
  ORGANISATIONAL_AFFILIATIONS,
} from "./identity.types";

import type {
  ProjectRoleAssignment,
} from "../project-membership/project-role.types";


const personId =
  "11111111-1111-4111-8111-111111111111";


test(
  "identity affiliation vocabulary contains INTERNAL and EXTERNAL",
  () => {
    assert.deepEqual(
      ORGANISATIONAL_AFFILIATIONS,
      [
        "INTERNAL",
        "EXTERNAL",
      ]
    );

    const internal:
      OrganisationalAffiliation = {
        personId,
        classification:
          "INTERNAL",
        organisationName:
          "Cadence",
        effectiveFrom:
          "2026-01-01T00:00:00.000Z",
        effectiveTo:
          null,
      };

    const external:
      OrganisationalAffiliation = {
        ...internal,
        classification:
          "EXTERNAL",
        organisationName:
          "Delivery Partner",
      };

    assert.equal(
      internal.classification,
      "INTERNAL"
    );

    assert.equal(
      external.classification,
      "EXTERNAL"
    );
  }
);


test(
  "EXTERNAL affiliation can be represented independently from PROJECT_MANAGER",
  () => {
    const affiliation:
      OrganisationalAffiliation = {
        personId,
        classification:
          "EXTERNAL",
        organisationName:
          "Delivery Partner",
        effectiveFrom:
          "2026-01-01T00:00:00.000Z",
        effectiveTo:
          null,
      };

    const roleAssignment:
      ProjectRoleAssignment = {
        id:
          "22222222-2222-4222-8222-222222222222",
        projectId:
          "33333333-3333-4333-8333-333333333333",
        membershipId:
          "44444444-4444-4444-8444-444444444444",
        role:
          "PROJECT_MANAGER",
        effectiveFrom:
          "2026-01-01T00:00:00.000Z",
        effectiveTo:
          null,
        assignedBy:
          "55555555-5555-4555-8555-555555555555",
        changeReason:
          null,
        createdAt:
          "2026-01-01T00:00:00.000Z",
      };

    assert.equal(
      affiliation.classification,
      "EXTERNAL"
    );

    assert.equal(
      roleAssignment.role,
      "PROJECT_MANAGER"
    );
  }
);


test(
  "authentication identity belongs to a stable person without project authority",
  () => {
    const person:
      CadencePerson = {
        id:
          personId,
        displayName:
          "Sarah Tan",
      };

    const authenticationIdentity:
      AuthenticationIdentity = {
        id:
          "66666666-6666-4666-8666-666666666666",
        personId:
          person.id,
        provider:
          "local",
        providerSubjectId:
          "provider-subject-1",
        loginIdentifier:
          "sarah@example.test",
        validFrom:
          "2026-01-01T00:00:00.000Z",
        validTo:
          null,
        status:
          "ACTIVE",
      };

    assert.equal(
      authenticationIdentity.personId,
      person.id
    );

    assert.equal(
      "projectId" in authenticationIdentity,
      false
    );

    assert.equal(
      "membershipId" in authenticationIdentity,
      false
    );

    assert.equal(
      "role" in authenticationIdentity,
      false
    );

    assert.equal(
      "permissions" in authenticationIdentity,
      false
    );
  }
);


test(
  "stable Person identity does not depend on email or provider data",
  () => {
    const person:
      CadencePerson = {
        id:
          personId,
        displayName:
          "Sarah Tan",
      };

    assert.equal(
      "email" in person,
      false
    );

    assert.equal(
      "provider" in person,
      false
    );

    assert.equal(
      "providerSubjectId" in person,
      false
    );
  }
);
