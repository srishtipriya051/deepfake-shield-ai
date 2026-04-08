import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import UploadSection from "../components/UploadSection";
import ResultSection from "../components/ResultSection";

function Dashboard() {
    return (
        <div style={styles.wrapper}>
            <Sidebar />

            <div style={styles.main}>
                <Navbar />

                <div style={styles.content}>
                    <UploadSection />
                    <ResultSection />
                </div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        display: "flex",
        minHeight: "100vh",
        background: "#0f172a",
        color: "white"
    },
    main: {
        flex: 1,
        padding: "20px",
        overflowY: "auto"
    },
    content: {
        marginTop: "20px"
    }
};

export default Dashboard;

