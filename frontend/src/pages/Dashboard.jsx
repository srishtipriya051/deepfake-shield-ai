import Navbar from "../components/navbar";
import Sidebar from "../components/Sidebar";
import UploadSection from "../components/UploadSection";
import ResultsSection from "../components/ResultsSection";

function Dashboard() {
    return (
        <div style={styles.wrapper}>
            <Sidebar />

            <div style={styles.main}>
                <Navbar />
                <UploadSection />
                <ResultsSection />
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        display: "flex",
        background: "#0f172a",
        minHeight: "100vh",
        color: "white"
    },
    main: {
        flex: 1,
        padding: "20px"
    }
};

export default Dashboard;