import ProposalDetails from "components/Proposals/ProposalDetails";
import { lazy, Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { FeaturePageGuard } from "components/WorkspaceFeatures/FeaturePageGuard";
import { WorkspaceFeatureProvider } from "components/WorkspaceFeatures/WorkspaceFeatureContext";
import { DashboardIndexRedirect } from "components/WorkspaceFeatures/DashboardIndexRedirect";
import StaffConsoleLayout from "@/features/staff-console/StaffConsoleLayout";
import OrganizationsPage from "@/features/staff-console/pages/OrganizationsPage";
import OrganizationDetailPage from "@/features/staff-console/pages/OrganizationDetailPage";
import WorkspacesPage from "@/features/staff-console/pages/WorkspacesPage";
import WorkspaceDetailPage from "@/features/staff-console/pages/WorkspaceDetailPage";
import PeoplePage from "@/features/staff-console/pages/PeoplePage";
import PersonDetailPage from "@/features/staff-console/pages/PersonDetailPage";
import FeaturesPage from "@/features/staff-console/pages/FeaturesPage";
import { setExternalLinkSegmentParams } from "store/modules/auth/action";
import { trackPageCall } from "analytics";
import ProtectedRouteErrorBoundary from "components/ProtectedRouteErrorBoundary";
import DataPlaceholderPage from "components/DataPlaceholder";
import { DATA_PLACEHOLDER_PAGES } from "components/DataPlaceholder/dataPages";
import SessionsPage from "@/features/sessions/SessionsPage";
import UiGalleryPage from "@/features/ui-gallery/UiGalleryPage";
import { getPendingInviteToken } from "components/WorkspaceFeatures/inviteToken";
import { APP_ROUTES } from "./appRoutes";
import { ArchivedDeepLink, ProtectedElement, PublicElement } from "./routeElements";
import { authRoutes } from "./authRoutes";
import { DashboardShell } from "./DashboardShell";
import { costAndHrRoutes } from "./costHrRoutes";
import { datasetRoutesA } from "./datasetRoutesA";
import { agentRoutes } from "./agentRoutes";
import { pageBuilderRoutes } from "./pageBuilderRoutes";
import { reportingRoutes } from "./reportingRoutes";
import { pulseRoutes } from "./pulseRoutes";
import { otherProductRoutes } from "./otherProductRoutes";
import { settingsRoutes } from "./settingsRoutes";
import { commerceRoutes } from "./commerceRoutes";
import { datasetRoutesB } from "./datasetRoutesB";
import { RouteLoadingFallback } from "./RouteLoadingFallback";

const LandingCreator = lazy(() => import("components/LandingCreator"));
const SHOW_UI_GALLERY = process.env.NODE_ENV !== "production";

function AppRoutes() {
  const authReducer = useSelector((state: { authReducer: { userSession: unknown } }) => state.authReducer);
  const userSession = authReducer.userSession;
  const dispatch = useDispatch();
  const search = useLocation().search;

  useEffect(() => {
    const searchParams = new URLSearchParams(search);
    if (searchParams.toString() !== "") {
      const resultJSON = JSON.parse(
        '{"' +
        decodeURI(
          searchParams.toString().replace(/&/g, '","').replace(/=/g, '":"')
        ) +
        '"}'
      );
      trackPageCall("", {}, { context: { campaign: resultJSON } });
      dispatch(setExternalLinkSegmentParams(resultJSON));
    }
  }, []);

  return (
    <Routes>
      {authRoutes(SHOW_UI_GALLERY)}

      {/* Alyson staff console — separate shell, no customer sidebar */}
      <Route
        path={APP_ROUTES.ALYSON_ADMIN.path}
        element={
          <ProtectedElement>
            <StaffConsoleLayout />
          </ProtectedElement>
        }
      >
        <Route index element={<Navigate to="organizations" replace />} />
        <Route path={APP_ROUTES.ALYSON_ADMIN_ORGANIZATIONS.path} element={<OrganizationsPage />} />
        <Route
          path={APP_ROUTES.ALYSON_ADMIN_ORGANIZATION.path}
          element={<OrganizationDetailPage />}
        />
        <Route path={APP_ROUTES.ALYSON_ADMIN_WORKSPACES.path} element={<WorkspacesPage />} />
        <Route path={APP_ROUTES.ALYSON_ADMIN_WORKSPACE.path} element={<WorkspaceDetailPage />} />
        <Route path={APP_ROUTES.ALYSON_ADMIN_PEOPLE.path} element={<PeoplePage />} />
        <Route path={APP_ROUTES.ALYSON_ADMIN_PERSON.path} element={<PersonDetailPage />} />
        <Route path={APP_ROUTES.ALYSON_ADMIN_FEATURES.path} element={<FeaturesPage />} />
      </Route>

      {/* Protected Routes */}
      <Route
        path={APP_ROUTES.DASHBOARD.path}
        element={<DashboardShell />}
      >
        <Route index element={<DashboardIndexRedirect />} />

        {costAndHrRoutes()}

        {datasetRoutesA()}
        {agentRoutes()}
        {pageBuilderRoutes()}
        {reportingRoutes()}
        {SHOW_UI_GALLERY && (
          <Route
            path={APP_ROUTES.UI_GALLERY.path}
            element={
              <ProtectedElement>
                <UiGalleryPage />
              </ProtectedElement>
            }
          />
        )}
        <Route
          path={`${APP_ROUTES.DATA_PLACEHOLDER.path}/sessions`}
          element={
            <ProtectedElement>
              <SessionsPage />
            </ProtectedElement>
          }
        />
        {DATA_PLACEHOLDER_PAGES.map(({ slug }) => (
          <Route
            key={`data-${slug}`}
            path={`${APP_ROUTES.DATA_PLACEHOLDER.path}/${slug}`}
            element={
              <ProtectedElement>
                <DataPlaceholderPage slug={slug} />
              </ProtectedElement>
            }
          />
        ))}
        {pulseRoutes()}
        {otherProductRoutes()}
        {settingsRoutes()}
        {commerceRoutes()}
        {datasetRoutesB()}
        <Route
          path={APP_ROUTES.PROPOSAL_DETAILS.path}
          element={
            <ProtectedElement>
              <ProposalDetails />
            </ProtectedElement>
          }
        />
      </Route>

      <Route
        path={APP_ROUTES.LANDING_CREATOR.path}
        element={
          <ProtectedElement>
            <WorkspaceFeatureProvider>
              <FeaturePageGuard>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <LandingCreator />
                </Suspense>
              </FeaturePageGuard>
            </WorkspaceFeatureProvider>
          </ProtectedElement>
        }
      />

      <Route
        path={APP_ROUTES.DEEPLINK_WEBSITE_WITHOUT_USER_ID.path}
        element={<ArchivedDeepLink />}
      ></Route>
      <Route
        path={APP_ROUTES.DEEPLINK_WEBSITE_WITH_USER_ID.path}
        element={<ArchivedDeepLink />}
      ></Route>
      <Route
        path={APP_ROUTES.DEEPLINK_PROPOSAL_WEBSITE_WITHOUT_USER_ID.path}
        element={<ArchivedDeepLink />}
      ></Route>

      <Route
        path={APP_ROUTES.DEEPLINK_INVITE.path}
        element={<ArchivedDeepLink />}
      ></Route>
      <Route
        path={APP_ROUTES.DEEPLINK_AUDIENCE_INVITE.path}
        element={<ArchivedDeepLink />}
      ></Route>
      <Route
        path={APP_ROUTES.DEEPLINK_SOURCE_INVITE.path}
        element={<ArchivedDeepLink />}
      ></Route>
      <Route
        path={APP_ROUTES.DEEPLINK_WEBSITE_JOIN_MARKETPLACE.path}
        element={<ArchivedDeepLink />}
      ></Route>

      <Route
        path={APP_ROUTES.DEEPLINK_PROPOSAL_CHAT_WEBSITE_WITH_USER_ID.path}
        element={<ArchivedDeepLink />}
      ></Route>
      <Route
        path={APP_ROUTES.DEEPLINK_EXTERNAL_SELLER_LISTING.path}
        element={<ArchivedDeepLink />}
      ></Route>
      <Route path="*" element={<Navigate to={APP_ROUTES.LANDING.path} />} />
    </Routes>
  );
}

export { APP_ROUTES } from "./appRoutes";
export default AppRoutes;
